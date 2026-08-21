import { describe, expect, it } from "vitest";
import {
  classifyAveragePressure,
  classifyAveragePressure24h,
} from "@/domain/mapa/rules/averagePressure";
import { mapaThresholds } from "@/domain/mapa/config/thresholds";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { computeValidMeasurementsPercentage } from "@/domain/mapa/rules/technicalQuality";

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
