import { describe, expect, it } from "vitest";
import { buildHistogramBins } from "@/components/BpHistogramCharts";

describe("buildHistogramBins", () => {
  it("agrupa valores em faixas de 10 e calcula percentual", () => {
    const bins = buildHistogramBins([100, 105, 110, 130], 80, 210, 10);

    const bin100 = bins.find((bin) => bin.start === 100);
    const bin110 = bins.find((bin) => bin.start === 110);
    const bin130 = bins.find((bin) => bin.start === 130);

    expect(bin100?.count).toBe(2);
    expect(bin100?.percent).toBeCloseTo(50, 5);
    expect(bin110?.count).toBe(1);
    expect(bin110?.percent).toBeCloseTo(25, 5);
    expect(bin130?.count).toBe(1);
    expect(bins.reduce((sum, bin) => sum + bin.percent, 0)).toBeCloseTo(100, 5);
  });

  it("prende valores fora da escala nas extremidades", () => {
    const bins = buildHistogramBins([50, 250], 80, 210, 10);
    expect(bins[0]?.count).toBe(1);
    expect(bins.at(-1)?.count).toBe(1);
    expect(bins.at(-1)?.start).toBe(200);
  });

  it("usa o último bin quando o valor é igual ao máximo", () => {
    const bins = buildHistogramBins([210], 80, 210, 10);
    expect(bins.at(-1)?.count).toBe(1);
    expect(bins.at(-1)?.percent).toBe(100);
  });
});
