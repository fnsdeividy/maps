import { describe, expect, it } from "vitest";
import {
  buildSleepBands,
  buildThresholdTrendSegments,
  classifyPressureZone,
  classifyValueZone,
} from "@/components/BpTimeChart";

describe("buildSleepBands", () => {
  it("marca sono que atravessa a meia-noite dentro do exame", () => {
    const start = Date.UTC(2026, 6, 27, 15, 0);
    const end = Date.UTC(2026, 6, 28, 14, 0);
    const bands = buildSleepBands(start, end, { start: "22:00", end: "07:00" });

    expect(bands).toHaveLength(1);
    expect(bands[0].from).toBe(Date.UTC(2026, 6, 27, 22, 0));
    expect(bands[0].to).toBe(Date.UTC(2026, 6, 28, 7, 0));
  });

  it("recorta o sono ao intervalo do exame", () => {
    const start = Date.UTC(2026, 6, 28, 1, 0);
    const end = Date.UTC(2026, 6, 28, 14, 0);
    const bands = buildSleepBands(start, end, { start: "22:00", end: "07:00" });

    expect(bands).toHaveLength(1);
    expect(bands[0].from).toBe(start);
    expect(bands[0].to).toBe(Date.UTC(2026, 6, 28, 7, 0));
  });
});

describe("classifyPressureZone", () => {
  const high = { systolic: 135, diastolic: 85 };

  it("marca acima quando PAS ou PAD supera o limiar", () => {
    expect(classifyPressureZone(140, 80, high)).toBe("above");
    expect(classifyPressureZone(130, 90, high)).toBe("above");
  });

  it("trata valores baixos como normal (sem faixa inferior)", () => {
    expect(classifyPressureZone(95, 70, high)).toBe("normal");
    expect(classifyPressureZone(120, 55, high)).toBe("normal");
  });

  it("marca normal dentro da faixa", () => {
    expect(classifyPressureZone(120, 70, high)).toBe("normal");
    expect(classifyPressureZone(135, 85, high)).toBe("normal");
  });
});

describe("classifyValueZone", () => {
  it("marca acima só depois do limiar", () => {
    expect(classifyValueZone(136, 135)).toBe("above");
    expect(classifyValueZone(135, 135)).toBe("normal");
    expect(classifyValueZone(100, 135)).toBe("normal");
  });
});

describe("buildThresholdTrendSegments", () => {
  it("mantém o segmento verde abaixo do limiar", () => {
    expect(
      buildThresholdTrendSegments([
        { x: 0, value: 120, threshold: 135 },
        { x: 10, value: 130, threshold: 135 },
      ]),
    ).toEqual([
      { x1: 0, yValue1: 120, x2: 10, yValue2: 130, zone: "normal" },
    ]);
  });

  it("mantém o segmento vermelho acima do limiar", () => {
    expect(
      buildThresholdTrendSegments([
        { x: 0, value: 140, threshold: 135 },
        { x: 10, value: 150, threshold: 135 },
      ]),
    ).toEqual([
      { x1: 0, yValue1: 140, x2: 10, yValue2: 150, zone: "above" },
    ]);
  });

  it("corta na linha amarela quando o valor cruza o limiar", () => {
    const segments = buildThresholdTrendSegments([
      { x: 0, value: 120, threshold: 135 },
      { x: 10, value: 150, threshold: 135 },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      x1: 0,
      yValue1: 120,
      yValue2: 135,
      zone: "normal",
    });
    expect(segments[1]).toMatchObject({
      yValue1: 135,
      x2: 10,
      yValue2: 150,
      zone: "above",
    });
    expect(segments[0].x2).toBeCloseTo(5);
    expect(segments[1].x1).toBeCloseTo(5);
  });
});
