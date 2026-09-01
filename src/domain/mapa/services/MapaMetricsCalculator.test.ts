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

function at(
  index: number,
  hour: number,
  minute: number,
  systolic: number,
  diastolic: number,
  overrides: Partial<MapaMeasurement> = {},
): MapaMeasurement {
  return {
    index,
    measuredAt: new Date(Date.UTC(2024, 8, 13, hour, minute)),
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

describe("auditoria de carga, períodos e descenso", () => {
  const window = { start: "22:00", end: "06:00" };

  it("TESTE 5: medidas do sono não entram no denominador da vigília e vice-versa", () => {
    const metrics = calculator.calculate(
      [
        measurement(1, 10, 140, 90),
        measurement(2, 12, 120, 70),
        measurement(3, 23, 140, 90),
        measurement(4, 2, 140, 90),
      ],
      window,
    );

    expect(metrics.awake?.count).toBe(2);
    expect(metrics.sleep?.count).toBe(2);
    // Vigília 135/85: 1/2 = 50%. Sono 120/70: 2/2 = 100%. Não usa o total 4.
    expect(metrics.awake?.systolicLoad).toBe(50);
    expect(metrics.sleep?.systolicLoad).toBe(100);
  });

  it("TESTE 7: leituras inválidas não entram no numerador nem no denominador", () => {
    const metrics = calculator.calculate(
      [
        measurement(1, 10, 140, 90),
        measurement(2, 12, 120, 70),
        measurement(3, 14, 200, 120, { valid: false }),
        measurement(4, 16, 200, 120, { valid: false }),
      ],
      window,
    );

    expect(metrics.awake?.count).toBe(2);
    expect(metrics.awake?.systolicLoad).toBe(50);
    expect(metrics.overall?.count).toBe(2);
    expect(metrics.overall?.systolicLoad).toBe(50);
  });

  it("TESTE 8: horário exatamente no início do sono entra no sono; o fim é exclusivo", () => {
    const metrics = calculator.calculate(
      [
        at(1, 21, 59, 130, 80),
        at(2, 22, 0, 110, 60),
        at(3, 5, 59, 110, 60),
        at(4, 6, 0, 130, 80),
      ],
      window,
    );

    expect(metrics.sleep?.count).toBe(2);
    expect(metrics.awake?.count).toBe(2);
    expect(metrics.sleep?.avgSystolic).toBe(110);
    expect(metrics.awake?.avgSystolic).toBe(130);
  });

  it("TESTE 9: descenso = ((média vigília − média sono) / média vigília) * 100", () => {
    const metrics = calculator.calculate(
      [measurement(1, 10, 130, 72), measurement(2, 23, 112, 63)],
      window,
    );

    const systolic = ((130 - 112) / 130) * 100;
    const diastolic = ((72 - 63) / 72) * 100;
    expect(metrics.systolicNightDipping).toBe(Math.round(systolic * 10) / 10);
    expect(metrics.diastolicNightDipping).toBe(Math.round(diastolic * 10) / 10);
    expect(metrics.systolicNightDipping).toBe(13.8);
    expect(metrics.diastolicNightDipping).toBe(12.5);
  });

  it("auditoria de exame sintético controlado: numerador, denominador e percentual", () => {
    const awakeReadings: MapaMeasurement[] = [];
    const sleepReadings: MapaMeasurement[] = [];

    // 12 vigília (08h–19h): 3 PAS ≥ 135, 6 PAD ≥ 85
    for (let hour = 8; hour <= 19; hour += 1) {
      const i = hour - 8;
      awakeReadings.push(
        measurement(
          i + 1,
          hour,
          i < 3 ? 140 : 120,
          i < 6 ? 90 : 70,
        ),
      );
    }
    // 8 sono (22h, 23h, 0h–5h): 2 PAS ≥ 120, 4 PAD ≥ 70
    const sleepHours = [22, 23, 0, 1, 2, 3, 4, 5];
    sleepHours.forEach((hour, i) => {
      sleepReadings.push(
        measurement(
          20 + i,
          hour,
          i < 2 ? 130 : 100,
          i < 4 ? 80 : 60,
        ),
      );
    });

    const metrics = calculator.calculate(
      [
        ...awakeReadings,
        ...sleepReadings,
        measurement(99, 10, 200, 150, { valid: false }),
      ],
      window,
    );

    expect(metrics.validMeasurements).toBe(20);
    expect(metrics.overall?.count).toBe(20);
    expect(metrics.awake?.count).toBe(12);
    expect(metrics.sleep?.count).toBe(8);

    // 24h limiar 130/80
    expect(metrics.overall?.systolicLoad).toBe(25); // 5/20
    expect(metrics.overall?.diastolicLoad).toBe(50); // 10/20
    // vigília 135/85
    expect(metrics.awake?.systolicLoad).toBe(25); // 3/12
    expect(metrics.awake?.diastolicLoad).toBe(50); // 6/12
    // sono 120/70
    expect(metrics.sleep?.systolicLoad).toBe(25); // 2/8
    expect(metrics.sleep?.diastolicLoad).toBe(50); // 4/8

    expect(metrics.awake?.avgSystolic).toBe(125);
    expect(metrics.sleep?.avgSystolic).toBe(107.5);
    expect(metrics.systolicNightDipping).toBe(14);
    expect(metrics.awake?.avgDiastolic).toBe(80);
    expect(metrics.sleep?.avgDiastolic).toBe(70);
    expect(metrics.diastolicNightDipping).toBe(12.5);
  });
});
