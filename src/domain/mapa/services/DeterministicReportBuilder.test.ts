import { describe, expect, it } from "vitest";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { ReportPhraseResolver } from "@/domain/mapa/services/ReportPhraseResolver";
import { DeterministicReportBuilder } from "@/domain/mapa/services/DeterministicReportBuilder";
import { REPORT_PHRASES } from "@/domain/mapa/config/phrases";

describe("laudo determinístico sem OpenAI", () => {
  it("gera as seções no formato do roteiro clínico", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "Uso de Bisoprolol 2,5mg às 7 horas.",
      avg24hSystolic: 127,
      avg24hDiastolic: 70,
      awakeSystolic: 130,
      awakeDiastolic: 80,
      sleepSystolic: 110,
      sleepDiastolic: 65,
      totalMeasurements: 81,
      validMeasurements: 76,
      officeSystolicPressure: 120,
      officeDiastolicPressure: 80,
      awakeSystolicLoad: 10,
      awakeDiastolicLoad: 8,
      sleepSystolicLoad: 5,
      sleepDiastolicLoad: 4,
      systolicNightDipping: 15,
      diastolicNightDipping: 14,
    });
    const resolved = new ReportPhraseResolver(
      REPORT_PHRASES.map((p) => ({ ...p, active: true })),
    ).resolve(results);
    const sections = new DeterministicReportBuilder().build(resolved);

    expect(sections.medications).toContain("Bisoprolol");
    expect(sections.medications).toContain("PA de Consultório");
    expect(sections.medications).toMatch(/120\/80/);
    expect(sections.technicalComments).toContain("qualidade técnica satisfatória");
    expect(sections.technicalComments).toContain("76");
    expect(sections.averagePressure).toContain("127/70");
    expect(sections.averagePressure).toContain("normal");
    expect(sections.pressureLoad).toContain("Vigília e no Sono normais");
    expect(sections.nightDipping).toContain("normais");
    expect(sections.generalConsiderations).toContain("Normotensão Verdadeira");
    expect(sections.conclusion).toContain("Normotensão Arterial Verdadeira");
    expect(sections.generalConsiderations).not.toContain(
      "Diretriz Brasileira de Hipertensão Arterial",
    );
  });
});
