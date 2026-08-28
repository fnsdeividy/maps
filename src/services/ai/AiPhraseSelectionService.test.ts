import { describe, expect, it } from "vitest";
import {
  buildCandidates,
  mergeSelection,
  parseSelection,
  type SelectionByCategory,
} from "@/services/ai/AiPhraseSelectionService";
import type { RuleResult } from "@/domain/mapa/types/clinical";
import type { StructuredReportSections } from "@/domain/mapa/types/report";

type Resolved = RuleResult & { text: string };

function deterministic(): StructuredReportSections {
  return {
    medications: "Não há relato de uso de medicações durante o exame.",
    technicalComments: "Qualidade satisfatória.",
    averagePressure: "Média 24h normal: 127/70 mmHg.",
    pressureLoad: "Cargas normais.",
    pressurePeaks: "Não informado.",
    nightDipping: "Descensos normais.",
    specialSituations: "Não informado.",
    generalConsiderations: "Não informado.",
    conclusion: "Exame compatível com Normotensão Verdadeira.",
  };
}

describe("buildCandidates", () => {
  const resolved: Resolved[] = [
    {
      code: "AVG_24H_BOTH_NORMAL",
      category: "AVERAGE_PRESSURE",
      message: "24h:BOTH_NORMAL",
      text: "A média 24h está normal: 127/70 mmHg.",
    },
    {
      code: "SPECIAL_SMOKING",
      category: "SPECIAL_SITUATION",
      message: "Relato de tabagismo.",
      text: "Relato de tabagismo.",
    },
  ];

  const catalog = [
    {
      code: "CONCLUSION_SUSTAINED",
      category: "CONCLUSION",
      text: "Exame compatível com Hipertensão Arterial Sustentada.",
      active: true,
    },
    {
      code: "AVG_24H_BOTH_ELEVATED",
      category: "AVERAGE_PRESSURE",
      text: "As médias 24h estão elevadas: {systolic}/{diastolic} mmHg.",
      active: true,
    },
    {
      code: "SPECIAL_ALCOHOL",
      category: "SPECIAL_SITUATION",
      text: "Relato de uso de bebidas alcoólicas.",
      active: true,
    },
    {
      code: "CONCLUSION_INACTIVE",
      category: "CONCLUSION",
      text: "Frase desativada.",
      active: false,
    },
  ];

  it("não oferece o lembrete de medicação cardiovascular como candidato", () => {
    const withReminder: Resolved[] = [
      {
        code: "CONCLUSION_SUSTAINED",
        category: "CONCLUSION",
        message: "SUSTAINED",
        text: "Exame com valores compatíveis com Hipertensão Arterial Sustentada.",
      },
      {
        code: "GENERAL_CONSIDER_CV_MEDS",
        category: "CONCLUSION",
        message: "CV_MEDS",
        text: "Considerar o uso de medicamentos de efeito cardiovascular.",
      },
    ];
    const candidates = buildCandidates(withReminder, [
      {
        code: "GENERAL_CONSIDER_CV_MEDS",
        category: "GENERAL_CONSIDERATION",
        text: "Considerar o uso de medicamentos de efeito cardiovascular.",
        active: true,
      },
    ]);
    const conclusionCodes = (candidates.CONCLUSION ?? []).map((c) => c.code);
    expect(conclusionCodes).toEqual(["CONCLUSION_SUSTAINED"]);
  });

  it("não oferece a frase consultório × MAPA junto com a conclusão", () => {
    const resolvedWithBoth: Resolved[] = [
      {
        code: "OFFICE_VS_MAPA_SUSTAINED",
        category: "GENERAL_CONSIDERATION",
        message: "SUSTAINED",
        text: "Os valores das médias pressóricas do MAPA 24horas comparadas aos valores de consultório são compatíveis com Hipertensão Arterial Sustentada.",
      },
      {
        code: "CONCLUSION_SUSTAINED",
        category: "CONCLUSION",
        message: "SUSTAINED",
        text: "Exame com valores compatíveis com Hipertensão Arterial Sustentada.",
      },
    ];
    const candidates = buildCandidates(resolvedWithBoth, []);
    const conclusionCodes = (candidates.CONCLUSION ?? []).map((c) => c.code);
    expect(conclusionCodes).toEqual(["CONCLUSION_SUSTAINED"]);
  });

  it("não amplia conclusão pelo catálogo (só o que o motor resolveu)", () => {
    const candidates = buildCandidates(resolved, catalog);
    const conclusionCodes = (candidates.CONCLUSION ?? []).map((c) => c.code);
    // O diagnóstico da interpretação vem só do motor; o catálogo não amplia.
    expect(conclusionCodes).not.toContain("CONCLUSION_SUSTAINED");
    expect(conclusionCodes).not.toContain("CONCLUSION_INACTIVE");
  });

  it("leva frases de considerações clínicas para a interpretação", () => {
    const withGeneral = [
      ...catalog,
      {
        code: "GENERAL_HR_PHYSIOLOGIC",
        category: "GENERAL_CONSIDERATION",
        text: "A variação das frequências cardíacas permaneceu fisiológica.",
        active: true,
      },
    ];
    const candidates = buildCandidates(resolved, withGeneral);
    const conclusionCodes = (candidates.CONCLUSION ?? []).map((c) => c.code);
    expect(conclusionCodes).toContain("GENERAL_HR_PHYSIOLOGIC");
  });

  it("exclui frases do catálogo com placeholders numéricos", () => {
    const candidates = buildCandidates(resolved, catalog);
    const avgCodes = (candidates.AVERAGE_PRESSURE ?? []).map((c) => c.code);
    expect(avgCodes).toContain("AVG_24H_BOTH_NORMAL");
    expect(avgCodes).not.toContain("AVG_24H_BOTH_ELEVATED");
  });

  it("não amplia situações especiais pelo catálogo (só declaradas)", () => {
    const candidates = buildCandidates(resolved, catalog);
    const specialCodes = (candidates.SPECIAL_SITUATION ?? []).map((c) => c.code);
    expect(specialCodes).toEqual(["SPECIAL_SMOKING"]);
  });
});

describe("mergeSelection", () => {
  const candidates = {
    CONCLUSION: [
      { code: "CONCLUSION_NORMOTENSION", text: "Normotensão." },
      { code: "CONCLUSION_SUSTAINED", text: "Hipertensão Sustentada." },
      { code: "G1", text: "Considerar X." },
    ],
  };

  it("usa o texto das frases selecionadas", () => {
    const selection: SelectionByCategory = {
      CONCLUSION: { codes: ["CONCLUSION_SUSTAINED"] },
    };
    const result = mergeSelection(candidates, selection, deterministic());
    expect(result.conclusion).toBe("Hipertensão Sustentada.");
  });

  it("não repete consultório × MAPA quando já há conclusão diagnóstica", () => {
    const withOffice = {
      CONCLUSION: [
        {
          code: "OFFICE_VS_MAPA_SUSTAINED",
          text: "Os valores das médias pressóricas são compatíveis com Hipertensão Arterial Sustentada.",
        },
        {
          code: "CONCLUSION_SUSTAINED",
          text: "Exame com valores compatíveis com Hipertensão Arterial Sustentada.",
        },
        {
          code: "GENERAL_CONSIDER_CV_MEDS",
          text: "Considerar o uso de medicamentos de efeito cardiovascular.",
        },
      ],
    };
    const result = mergeSelection(
      withOffice,
      {
        CONCLUSION: {
          codes: [
            "OFFICE_VS_MAPA_SUSTAINED",
            "CONCLUSION_SUSTAINED",
            "GENERAL_CONSIDER_CV_MEDS",
          ],
        },
      },
      deterministic(),
    );
    expect(result.conclusion).toBe(
      "Exame com valores compatíveis com Hipertensão Arterial Sustentada.",
    );
  });

  it("usa a opinião quando não há códigos escolhidos", () => {
    const selection: SelectionByCategory = {
      CONCLUSION: { codes: [], opinion: "Acompanhamento clínico." },
    };
    const result = mergeSelection(candidates, selection, deterministic());
    expect(result.conclusion).toBe("Acompanhamento clínico.");
  });

  it("omite o lembrete de medicação da opinião da IA", () => {
    const selection: SelectionByCategory = {
      CONCLUSION: {
        codes: [],
        opinion:
          "Exame com valores compatíveis com Hipertensão Arterial Sustentada. Considerar o uso de medicamentos de efeito cardiovascular.",
      },
    };
    const result = mergeSelection(candidates, selection, deterministic());
    expect(result.conclusion).toBe(
      "Exame com valores compatíveis com Hipertensão Arterial Sustentada.",
    );
  });

  it("mantém o determinístico quando a IA não escolhe nem opina", () => {
    const base = deterministic();
    const selection: SelectionByCategory = {
      CONCLUSION: { codes: [] },
    };
    const result = mergeSelection(candidates, selection, base);
    expect(result.conclusion).toBe(base.conclusion);
    expect(result.medications).toBe(base.medications);
  });
});

describe("parseSelection", () => {
  it("mapeia o JSON por tópico para seleção por categoria", () => {
    const selection = parseSelection({
      conclusion: { codes: ["A"], opinion: "x" },
      generalConsiderations: { codes: ["B"] },
      technicalComments: { codes: ["IGNORED"] },
      medications: { codes: ["IGNORED"] },
    });
    expect(selection.CONCLUSION?.codes).toEqual(["A"]);
    expect(selection.GENERAL_CONSIDERATION).toBeUndefined();
    // Tópicos factuais (técnico) e medicações não são compostos pela IA.
    expect(selection.TECHNICAL_QUALITY).toBeUndefined();
    expect(selection.MEDICATION).toBeUndefined();
  });
});
