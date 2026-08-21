import { describe, expect, it } from "vitest";
import { MapaMetricsCalculator } from "@/domain/mapa/services/MapaMetricsCalculator";
import type { MapaMeasurement } from "@/domain/mapa/import/awp/types";

const calculator = new MapaMetricsCalculator();

function measurement(
  index: number,
  hour: number,
  systolic: number,
  diastolic: number,
  overrides: Partial<MapaMeasurement> = {},
): MapaMeasurement {
  return {
    index,
    measuredAt: new Date(Date.UTC(2024, 8, 13, hour, 0)),
    systolic,
    diastolic,
    heartRate: 70,
    valid: true,
    ...overrides,
  };
}

describe("MapaMetricsCalculator", () => {
  it("calcula médias de 24h usando apenas medições válidas", () => {
    const metrics = calculator.calculate([
      measurement(1, 10, 130, 80),
      measurement(2, 12, 120, 70),
      measurement(3, 14, 999, 999, { valid: false }),
    ]);

    expect(metrics.totalMeasurements).toBe(3);
    expect(metrics.validMeasurements).toBe(2);
    expect(metrics.invalidMeasurements).toBe(1);
    expect(metrics.validMeasurementsPercentage).toBeCloseTo(66.7, 1);
    expect(metrics.avg24hSystolic).toBe(125);
    expect(metrics.avg24hDiastolic).toBe(75);
    expect(metrics.maxSystolic).toBe(130);
  });

  it("não calcula vigília e sono sem janela informada", () => {
    const metrics = calculator.calculate([measurement(1, 10, 130, 80)]);
    expect(metrics.awake).toBeNull();
    expect(metrics.sleep).toBeNull();
    expect(metrics.systolicNightDipping).toBeNull();
  });

  it("separa vigília e sono pela janela informada, atravessando a meia-noite", () => {
    const measurements = [
      measurement(1, 10, 130, 80),
      measurement(2, 20, 130, 80),
      measurement(3, 23, 112, 63),
      measurement(4, 2, 112, 63),
    ];

    const metrics = calculator.calculate(measurements, { start: "22:00", end: "06:00" });

    expect(metrics.awake?.count).toBe(2);
    expect(metrics.sleep?.count).toBe(2);
    expect(metrics.awake?.avgSystolic).toBe(130);
    expect(metrics.sleep?.avgSystolic).toBe(112);
  });

  it("calcula descenso noturno pela fórmula percentual", () => {
    const metrics = calculator.calculate(
      [measurement(1, 10, 130, 72), measurement(2, 23, 112, 63)],
      { start: "22:00", end: "06:00" },
    );

    // (130 - 112) / 130 * 100 = 13,8 %  e  (72 - 63) / 72 * 100 = 12,5 %
    expect(metrics.systolicNightDipping).toBe(13.8);
    expect(metrics.diastolicNightDipping).toBe(12.5);
  });

  it("calcula cargas pressóricas com os limiares configurados", () => {
    const metrics = calculator.calculate(
      [
        measurement(1, 10, 140, 90),
        measurement(2, 12, 130, 80),
        measurement(3, 14, 120, 70),
        measurement(4, 16, 110, 60),
      ],
      { start: "22:00", end: "06:00" },
    );

    // Limiar de vigília: 135/85 — 1 de 4 medições acima em cada componente.
    expect(metrics.awake?.systolicLoad).toBe(25);
    expect(metrics.awake?.diastolicLoad).toBe(25);
  });

  it("registra o pico com data e hora, sem classificá-lo", () => {
    const metrics = calculator.calculate([
      measurement(1, 10, 130, 80),
      measurement(2, 15, 168, 102),
    ]);

    expect(metrics.peakSystolic?.value).toBe(168);
    expect(metrics.peakSystolic?.at.getUTCHours()).toBe(15);
    expect(metrics.peakDiastolic?.value).toBe(102);
  });

  it("ignora janela de sono inválida em vez de assumir um padrão", () => {
    const metrics = calculator.calculate([measurement(1, 10, 130, 80)], {
      start: "abc",
      end: "06:00",
    });
    expect(metrics.sleepWindow).toBeNull();
    expect(metrics.awake).toBeNull();
  });

  it("calcula frequência cardíaca só quando presente", () => {
    const metrics = calculator.calculate([
      measurement(1, 10, 130, 80, { heartRate: 60 }),
      measurement(2, 12, 120, 70, { heartRate: undefined }),
    ]);

    expect(metrics.avgHeartRate).toBe(60);
    expect(metrics.minHeartRate).toBe(60);
    expect(metrics.maxHeartRate).toBe(60);
  });
});
