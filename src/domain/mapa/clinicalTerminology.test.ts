import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_PHRASES } from "@/domain/mapa/config/phrases";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { ReportPhraseResolver } from "@/domain/mapa/services/ReportPhraseResolver";
import { DeterministicReportBuilder } from "@/domain/mapa/services/DeterministicReportBuilder";

function catalog() {
  return REPORT_PHRASES.map((phrase) => ({ ...phrase, active: true }));
}

describe("terminologia clínica do laudo", () => {
  it("TESTE 10: o texto final usa descenso e não queda", () => {
    const results = new MapaRuleEngine().evaluate({
      currentMedications: "",
      systolicNightDipping: 0,
      diastolicNightDipping: 0,
      awakeSystolicLoad: 10,
      awakeDiastolicLoad: 8,
      sleepSystolicLoad: 5,
      sleepDiastolicLoad: 4,
    });
    const sections = new DeterministicReportBuilder().build(
      new ReportPhraseResolver(catalog()).resolve(results),
    );
    const text = Object.values(sections).join("\n");
    expect(text).toMatch(/descenso/i);
    expect(text).not.toMatch(/\queda\b/i);
  });

  it("TESTE 11: o texto final usa vigília/sono, não dia/noite como períodos", () => {
    const results = new MapaRuleEngine().evaluate({
      currentMedications: "",
      avg24hSystolic: 127,
      avg24hDiastolic: 70,
      awakeSystolic: 130,
      awakeDiastolic: 80,
      sleepSystolic: 110,
      sleepDiastolic: 65,
      awakeSystolicLoad: 10,
      awakeDiastolicLoad: 8,
      sleepSystolicLoad: 5,
      sleepDiastolicLoad: 4,
    });
    const sections = new DeterministicReportBuilder().build(
      new ReportPhraseResolver(catalog()).resolve(results),
    );
    const text = Object.values(sections).join("\n");
    expect(text).toMatch(/Vigília/);
    expect(text).toMatch(/Sono/);
    expect(text).not.toMatch(/período diurno/i);
    expect(text).not.toMatch(/período noturno/i);
    expect(text).not.toMatch(/\bnoite\b/i);
  });

  it("o catálogo de frases não usa queda nem dia/noite como período do MAPA", () => {
    for (const phrase of REPORT_PHRASES) {
      expect(phrase.text, phrase.code).not.toMatch(/\queda\b/i);
      expect(phrase.text, phrase.code).not.toMatch(/período diurno/i);
      expect(phrase.text, phrase.code).not.toMatch(/período noturno/i);
    }
    expect(REPORT_PHRASES.some((phrase) => phrase.text.includes("descenso"))).toBe(
      true,
    );
  });

  it("impressão e gráfico não rotulam períodos como dia/noite nem descenso como queda", () => {
    const root = path.resolve(__dirname, "../../..");
    const print = readFileSync(
      path.join(root, "src/components/mapa/MapaPrintDocument.tsx"),
      "utf8",
    );
    const chart = readFileSync(
      path.join(root, "src/components/BpTimeChart.tsx"),
      "utf8",
    );
    expect(print).not.toMatch(/Queda noturna/);
    expect(print).not.toMatch(/Médias de BP dia/);
    expect(print).not.toMatch(/Médias de BP noite/);
    expect(print).toMatch(/Descenso SIS/);
    expect(print).toMatch(/Médias de BP na vigília/);
    expect(print).toMatch(/Médias de BP no sono/);
    expect(chart).not.toMatch(/>\s*Dia\s*</);
    expect(chart).not.toMatch(/>\s*Noite\s*</);
    expect(chart).toMatch(/>\s*Vigília\s*</);
    expect(chart).toMatch(/>\s*Sono\s*</);
  });
});
