import { describe, expect, it } from "vitest";
import { calculatePressureLoad } from "@/domain/mapa/rules/pressureLoad";

describe("calculatePressureLoad", () => {
  it("TESTE 1: 0 medidas alteradas em 20 válidas = 0%", () => {
    const values = Array.from({ length: 20 }, () => 110);
    expect(calculatePressureLoad(values, 135)).toEqual({
      validReadings: 20,
      aboveThreshold: 0,
      threshold: 135,
      percent: 0,
    });
  });

  it("TESTE 2: 5 / 20 = 25%", () => {
    const values = [...Array.from({ length: 5 }, () => 140), ...Array.from({ length: 15 }, () => 120)];
    expect(calculatePressureLoad(values, 135).percent).toBe(25);
  });

  it("TESTE 3: 10 / 20 = 50%", () => {
    const values = [...Array.from({ length: 10 }, () => 140), ...Array.from({ length: 10 }, () => 120)];
    expect(calculatePressureLoad(values, 135).percent).toBe(50);
  });

  it("TESTE 4: 20 / 20 = 100%", () => {
    const values = Array.from({ length: 20 }, () => 140);
    expect(calculatePressureLoad(values, 135).percent).toBe(100);
  });

  it("TESTE 6: sistólica e diastólica são calculadas separadamente", () => {
    const systolic = [140, 120, 120, 120];
    const diastolic = [90, 90, 70, 70];
    expect(calculatePressureLoad(systolic, 135).percent).toBe(25);
    expect(calculatePressureLoad(diastolic, 85).percent).toBe(50);
  });

  it("inclui valores iguais ao limiar (comparação >=)", () => {
    expect(calculatePressureLoad([135, 134], 135)).toMatchObject({
      aboveThreshold: 1,
      percent: 50,
    });
  });

  it("sem leituras válidas não inventa percentual", () => {
    expect(calculatePressureLoad([], 135).percent).toBeNull();
  });
});
