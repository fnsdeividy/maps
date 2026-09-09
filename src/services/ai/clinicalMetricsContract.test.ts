import { describe, expect, it } from "vitest";
import { buildClinicalContext } from "@/services/reports/clinicalContext";
import {
  AI_COMPOSED_CATEGORIES,
  SYSTEM_PROMPT,
  mergeSelection,
} from "@/services/ai/AiPhraseSelectionService";
import type { StructuredReportSections } from "@/domain/mapa/types/report";

function deterministic(): StructuredReportSections {
  return {
    medications: "Não há relato de uso de medicações durante o exame.",
    technicalComments: "Qualidade satisfatória.",
    averagePressure: "Média 24h normal: 127/70 mmHg.",
    pressureLoad:
      "Cargas pressóricas na Vigília e no Sono normais. (12.5% / 8% na Vigília; 5% / 4% no Sono).",
    pressurePeaks: "Não informado.",
    nightDipping: "Descensos pressóricos sistólico e diastólico normais. (15% / 14%, respectivamente)",
    specialSituations: "Não informado.",
    generalConsiderations: "Não informado.",
    conclusion: "Exame compatível com Normotensão Arterial Verdadeira.",
  };
}

describe("contrato da IA com métricas pré-calculadas", () => {
  it("TESTE 12: o contexto envia o percentual já calculado e a IA não recálcula", () => {
    const context = buildClinicalContext(
      {
        currentMedications: "",
        officeSystolicPressure: 120,
        officeDiastolicPressure: 80,
        avg24hSystolic: 127,
        avg24hDiastolic: 70,
        awakeSystolic: 130,
        awakeDiastolic: 80,
        sleepSystolic: 110,
        sleepDiastolic: 65,
        overallSystolicLoad: 18.4,
        overallDiastolicLoad: 9.1,
        awakeSystolicLoad: 12.5,
        awakeDiastolicLoad: 8,
        sleepSystolicLoad: 5,
        sleepDiastolicLoad: 4,
        systolicNightDipping: 15,
        diastolicNightDipping: 14,
      },
      94,
    );

    expect(context).toContain("Não recalcule nenhuma métrica numérica");
    expect(context).toContain("Carga pressórica vigília PAS: 12.5%");
    expect(context).toContain("Carga pressórica vigília PAD: 8%");
    expect(context).toContain("Carga pressórica sono PAS: 5%");
    expect(context).toContain("Carga pressórica 24h PAS: 18.4%");
    expect(context).toContain("Descenso sistólico: 15%");
    expect(SYSTEM_PROMPT).toContain("Não recalcule nenhuma métrica numérica");
    expect(SYSTEM_PROMPT).toContain("Utilize exatamente os valores fornecidos pelo sistema");
    expect(AI_COMPOSED_CATEGORIES).toEqual(["CONCLUSION"]);
  });

  it("não permite que a IA substitua o texto determinístico de cargas ou descenso", () => {
    const base = deterministic();
    const result = mergeSelection(
      {
        CONCLUSION: [{ code: "CONCLUSION_NORMOTENSION", text: "Normotensão." }],
        PRESSURE_LOAD: [
          { code: "LOAD_FAKE", text: "Carga pressórica elevada de 45%." },
        ],
        NIGHT_DIPPING: [{ code: "DIP_FAKE", text: "Queda noturna ausente." }],
      },
      {
        CONCLUSION: { codes: ["CONCLUSION_NORMOTENSION"] },
        PRESSURE_LOAD: {
          codes: ["LOAD_FAKE"],
          opinion: "Carga pressórica elevada de 45%.",
        },
        NIGHT_DIPPING: { codes: ["DIP_FAKE"] },
      },
      base,
    );

    expect(result.pressureLoad).toBe(base.pressureLoad);
    expect(result.nightDipping).toBe(base.nightDipping);
    expect(result.pressureLoad).toContain("12.5%");
    expect(result.pressureLoad).not.toContain("45%");
  });
});
