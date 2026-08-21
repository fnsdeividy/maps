import { describe, expect, it } from "vitest";
import {
  buildPieSegments,
  buildPieSeriesStats,
} from "@/components/BpPieCharts";

describe("buildPieSegments", () => {
  it("classifica acima, normal e abaixo do intervalo", () => {
    const segments = buildPieSegments([90, 100, 120, 135, 140], 100, 135);
    const byKey = Object.fromEntries(
      segments.map((segment) => [segment.key, segment]),
    );

    expect(byKey.below.count).toBe(1);
    expect(byKey.normal.count).toBe(3);
    expect(byKey.above.count).toBe(1);
    expect(byKey.below.percent).toBeCloseTo(20, 5);
    expect(byKey.normal.percent).toBeCloseTo(60, 5);
    expect(byKey.above.percent).toBeCloseTo(20, 5);
  });
});

describe("buildPieSeriesStats", () => {
  it("calcula máximo, mínimo e média", () => {
    const at = new Date(2026, 6, 27, 15, 0);
    const stats = buildPieSeriesStats([
      { value: 100, at },
      { value: 150, at: new Date(2026, 6, 27, 19, 0) },
      { value: 80, at: new Date(2026, 6, 27, 23, 0) },
    ]);

    expect(stats.max?.value).toBe(150);
    expect(stats.min?.value).toBe(80);
    expect(stats.mean).toBeCloseTo(110, 5);
  });
});
