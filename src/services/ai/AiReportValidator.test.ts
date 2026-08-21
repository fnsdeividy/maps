import { describe, expect, it } from "vitest";
import { AiReportValidator } from "@/services/ai/AiReportValidator";
import type { StructuredReportSections } from "@/domain/mapa/types/report";

const draft: StructuredReportSections = {
  medications: "Não há relato de uso de medicações durante o exame.",
  technicalComments: "Este parâmetro ainda depende de configuração médica.",
  averagePressure:
    "A média pressórica sistólica e diastólica total no MAPA 24 horas está normal: 127/70 mmHg.",
  pressureLoad: "Não informado.",
  pressurePeaks: "Não informado.",
  nightDipping: "Não informado.",
  specialSituations: "Não informado.",
  generalConsiderations:
    "Os valores das médias pressóricas do MAPA 24horas comparadas aos valores de consultório são compatíveis com Normotensão Verdadeira.",
  conclusion:
    "Este parâmetro ainda depende de configuração médica. A conclusão comparativa consultório × MAPA aguarda definição dos limiares de consultório.",
};

describe("AiReportValidator", () => {
  const validator = new AiReportValidator();

  it("aceita redação que preserva valores e conclusão", () => {
    const result = validator.validate(draft, { ...draft }, "");
    expect(result.ok).toBe(true);
  });

  it("rejeita conclusão alterada", () => {
    const result = validator.validate(
      draft,
      { ...draft, conclusion: "Hipertensão sustentada." },
      "",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("conclusion_changed");
  });

  it("rejeita número inventado", () => {
    const result = validator.validate(
      draft,
      { ...draft, averagePressure: draft.averagePressure.replace("127", "180") },
      "",
    );
    expect(result.ok).toBe(false);
  });

  it("rejeita medicação inventada quando não há relato", () => {
    const result = validator.validate(
      draft,
      { ...draft, medications: "Uso de Losartana 50 mg." },
      "",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invented_medication");
  });
});
