import { describe, expect, it } from "vitest";
import {
  classifyAveragePressure,
  classifyAveragePressure24h,
} from "@/domain/mapa/rules/averagePressure";
import { mapaThresholds } from "@/domain/mapa/config/thresholds";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { computeValidMeasurementsPercentage } from "@/domain/mapa/rules/technicalQuality";
import { ReportPhraseResolver } from "@/domain/mapa/services/ReportPhraseResolver";
import { REPORT_PHRASES } from "@/domain/mapa/config/phrases";

describe("médias 24h", () => {
  const t = mapaThresholds.full24Hours;

  it("127/70 => normal", () => {
    expect(classifyAveragePressure(127, 70, t)).toBe("BOTH_NORMAL");
  });

  it("135/70 => sistólica elevada", () => {
    expect(classifyAveragePressure(135, 70, t)).toBe("SYS_ELEVATED");
  });

  it("127/85 => diastólica elevada", () => {
    expect(classifyAveragePressure(127, 85, t)).toBe("DIA_ELEVATED");
  });

  it("135/85 => sistólica e diastólica elevadas", () => {
    expect(classifyAveragePressure(135, 85, t)).toBe("BOTH_ELEVATED");
  });

  it("165/105 => significativamente elevada", () => {
    expect(
      classifyAveragePressure24h(
        165,
        105,
        t,
        mapaThresholds.significantlyElevatedThresholds,
      ),
    ).toBe("BOTH_SIGNIFICANTLY_ELEVATED");
  });
});

describe("vigília e sono", () => {
  it("vigília 134,7/74 classifica como 135 (elevada), não como 134,7 (normal)", () => {
    expect(classifyAveragePressure(134.7, 74, mapaThresholds.awake)).toBe(
      "SYS_ELEVATED",
    );
    expect(classifyAveragePressure(134.4, 74, mapaThresholds.awake)).toBe(
      "BOTH_NORMAL",
    );
  });

  it("laudo Cecerina: 134,6 na vigília vira 135 elevada; 24h 130,7 vira 131 elevada", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications:
        "Maleato de enalapril10mg : 09:30h\nFurosemida 40mg: 10:10h",
      cvMedicationStatus: "YES",
      officeSystolicPressure: 180,
      officeDiastolicPressure: 80,
      totalMeasurements: 84,
      validMeasurements: 78,
      avg24hSystolic: 130.7,
      avg24hDiastolic: 70.2,
      awakeSystolic: 134.6,
      awakeDiastolic: 74,
      sleepSystolic: 117.6,
      sleepDiastolic: 57.3,
      awakeSystolicLoad: 48.3,
      awakeDiastolicLoad: 16.7,
      sleepSystolicLoad: 38.9,
      sleepDiastolicLoad: 5.6,
      systolicNightDipping: 12.6,
      diastolicNightDipping: 22.6,
    });
    const resolved = new ReportPhraseResolver(
      REPORT_PHRASES.map((phrase) => ({ ...phrase, active: true })),
    ).resolve(results);

    expect(results.some((item) => item.code === "AVG_24H_SYS_ELEVATED")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "AVG_AWAKE_SYS_ELEVATED")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "AVG_AWAKE_BOTH_NORMAL")).toBe(
      false,
    );
    expect(results.some((item) => item.code === "AVG_SLEEP_BOTH_NORMAL")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "OFFICE_VS_MAPA_SUSTAINED")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "CONCLUSION_SUSTAINED")).toBe(
      true,
    );

    const awake = resolved.find((item) => item.code === "AVG_AWAKE_SYS_ELEVATED");
    expect(awake?.text).toContain("135/74");
    expect(awake?.text).toMatch(/elevada/i);

    const full24h = resolved.find((item) => item.code === "AVG_24H_SYS_ELEVATED");
    expect(full24h?.text).toContain("131/70");
  });

  it("frase da vigília cita 135/74 elevada quando a média crua é 134,7/74,2", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      awakeSystolic: 134.7,
      awakeDiastolic: 74.2,
    });
    expect(results.some((item) => item.code === "AVG_AWAKE_SYS_ELEVATED")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "AVG_AWAKE_BOTH_NORMAL")).toBe(
      false,
    );
    const text = new ReportPhraseResolver(
      REPORT_PHRASES.map((phrase) => ({ ...phrase, active: true })),
    )
      .resolve(results)
      .find((item) => item.code === "AVG_AWAKE_SYS_ELEVATED")?.text;
    expect(text).toContain("135/74");
    expect(text).toMatch(/elevada/i);
    expect(text).not.toContain("134.7");
  });

  it("vigília 135/85 => ambos elevados", () => {
    expect(classifyAveragePressure(135, 85, mapaThresholds.awake)).toBe(
      "BOTH_ELEVATED",
    );
  });

  it("sono 120/70 => ambos elevados no limite", () => {
    expect(classifyAveragePressure(120, 70, mapaThresholds.sleep)).toBe(
      "BOTH_ELEVATED",
    );
  });

  it("sono 119/69 => normal", () => {
    expect(classifyAveragePressure(119, 69, mapaThresholds.sleep)).toBe(
      "BOTH_NORMAL",
    );
  });
});

describe("qualidade técnica", () => {
  it("emite qualidade satisfatória quando percentual atinge o limiar", () => {
    expect(computeValidMeasurementsPercentage(76, 81)).toBeCloseTo(93.827, 2);
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      totalMeasurements: 81,
      validMeasurements: 76,
    });
    expect(results.some((item) => item.code === "TECH_SATISFACTORY")).toBe(true);
  });

  it("sugere repetição quando qualidade fica abaixo do limiar", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      totalMeasurements: 100,
      validMeasurements: 50,
    });
    expect(results.some((item) => item.code === "TECH_SUGGEST_REPEAT")).toBe(true);
  });
});

describe("cargas e descenso", () => {
  it("classifica carga elevada na vigília", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      awakeSystolicLoad: 76.2,
      awakeDiastolicLoad: 10,
      sleepSystolicLoad: 5,
      sleepDiastolicLoad: 5,
    });
    expect(results.some((item) => item.code === "LOAD_AWAKE_SYS_ELEVATED")).toBe(
      true,
    );
  });

  it("vigília abaixo de 40% e sono abaixo de 50% são cargas normais", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      awakeSystolicLoad: 39.9,
      awakeDiastolicLoad: 20,
      sleepSystolicLoad: 49.9,
      sleepDiastolicLoad: 30,
    });
    expect(results.some((item) => item.code === "LOAD_BOTH_PERIODS_NORMAL")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "LOAD_AWAKE_SYS_ELEVATED")).toBe(
      false,
    );
    expect(results.some((item) => item.code === "LOAD_SLEEP_SYS_ELEVATED")).toBe(
      false,
    );
  });

  it("sono a 50% já é carga elevada, vigília a 40% também", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      awakeSystolicLoad: 40,
      awakeDiastolicLoad: 10,
      sleepSystolicLoad: 50,
      sleepDiastolicLoad: 10,
    });
    expect(results.some((item) => item.code === "LOAD_AWAKE_SYS_ELEVATED")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "LOAD_SLEEP_SYS_ELEVATED")).toBe(
      true,
    );
  });

  it("classifica descenso atenuado", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      systolicNightDipping: 8,
      diastolicNightDipping: 15,
    });
    expect(results.some((item) => item.code === "DIP_SYS_ATTENUATED")).toBe(true);
  });
});
