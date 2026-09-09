import { describe, expect, it } from "vitest";
import { mapaThresholds } from "@/domain/mapa/config/thresholds";
import { buildMapaPrintStatistics } from "@/domain/mapa/services/MapaPrintStatistics";
import type { MapaMeasurement } from "@/domain/mapa/import/awp/types";

function m(
  index: number,
  hour: number,
  minute: number,
  systolic: number,
  diastolic: number,
  heartRate = 70,
): MapaMeasurement {
  return {
    index,
    measuredAt: new Date(Date.UTC(2026, 7, 18, hour, minute)),
    systolic,
    diastolic,
    heartRate,
    meanArterialPressure: Math.round((systolic + 2 * diastolic) / 3),
    valid: true,
  };
}

describe("MapaPrintStatistics", () => {
  it("monta estatísticas gerais, vigília e sono com CV e cargas", () => {
    const measurements = [
      m(1, 10, 0, 140, 90, 80),
      m(2, 14, 0, 130, 80, 72),
      m(3, 23, 0, 110, 65, 60),
      m(4, 3, 0, 105, 60, 55),
    ];

    const stats = buildMapaPrintStatistics(measurements, mapaThresholds, {
      start: "22:00",
      end: "07:00",
    });

    expect(stats.validCount).toBe(4);
    expect(stats.awake?.count).toBe(2);
    expect(stats.sleep?.count).toBe(2);
    expect(stats.peakSystolic?.value).toBe(140);
    expect(stats.troughSystolic?.value).toBe(105);
    expect(stats.durationLabel).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(stats.cvOverallSystolic).not.toBeNull();
    expect(stats.awakeSystolicLoad).not.toBeNull();
    expect(stats.awake?.label).toBe("Vigília");
    expect(stats.sleep?.label).toBe("Sono");
  });

  it("usa a mesma carga pressórica do calculador (vigília e sono isolados)", () => {
    const measurements = [
      m(1, 10, 0, 140, 90),
      m(2, 14, 0, 120, 70),
      m(3, 23, 0, 130, 80),
      m(4, 3, 0, 100, 60),
    ];
    const stats = buildMapaPrintStatistics(measurements, mapaThresholds, {
      start: "22:00",
      end: "06:00",
    });

    expect(stats.overall.systolicLoadPercent).toBe(50); // 2/4 ≥ 130
    expect(stats.awakeSystolicLoad).toBe(50); // 1/2 ≥ 135
    expect(stats.sleepSystolicLoad).toBe(50); // 1/2 ≥ 120
    expect(stats.awakeDiastolicLoad).toBe(50); // 1/2 ≥ 85
    expect(stats.sleepDiastolicLoad).toBe(50); // 1/2 ≥ 70
  });
});
