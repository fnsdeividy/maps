import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContecAbpm50AwpParser } from "@/domain/mapa/import/awp/ContecAbpm50AwpParser";
import { MapaMetricsCalculator } from "@/domain/mapa/services/MapaMetricsCalculator";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "contec-abpm50");

type Expected = {
  measurementCount?: number;
  validMeasurements?: number;
  avg24hSystolic?: number;
  avg24hDiastolic?: number;
  sleepWindow?: { start: string; end: string };
  avgAwakeSystolic?: number;
  avgAwakeDiastolic?: number;
  avgSleepSystolic?: number;
  avgSleepDiastolic?: number;
  systolicDipping?: number;
  diastolicDipping?: number;
};

function listGoldenCases(): string[] {
  try {
    return readdirSync(FIXTURES_DIR)
      .filter((name) => name.toLowerCase().endsWith(".awp"))
      .filter((name) => {
        const expected = name.replace(/\.awp$/i, ".expected.json");
        return readdirSync(FIXTURES_DIR).includes(expected);
      });
  } catch {
    return [];
  }
}

const cases = listGoldenCases();

/**
 * Compara o que o nosso parser extrai com o que o software oficial da CONTEC
 * apresenta para o mesmo arquivo. Sem um par .awp + .expected.json nesta pasta,
 * o parser não pode ser considerado validado — o teste registra isso.
 */
describe("contec-abpm50 golden files", () => {
  it.runIf(cases.length === 0)(
    "nenhum arquivo real disponível: parser segue EXPERIMENTAL",
    () => {
      expect(cases).toHaveLength(0);
    },
  );

  for (const fileName of cases) {
    it(`reproduz os números oficiais de ${fileName}`, async () => {
      const buffer = readFileSync(path.join(FIXTURES_DIR, fileName));
      const expected = JSON.parse(
        readFileSync(
          path.join(FIXTURES_DIR, fileName.replace(/\.awp$/i, ".expected.json")),
          "utf8",
        ),
      ) as Expected;

      const result = await new ContecAbpm50AwpParser().parse(buffer, fileName);
      const sleepWindow =
        expected.sleepWindow ??
        (result.sleepWindow
          ? { start: result.sleepWindow.start, end: result.sleepWindow.end }
          : null);
      const metrics = new MapaMetricsCalculator().calculate(result.measurements, sleepWindow);

      if (expected.measurementCount !== undefined) {
        expect(metrics.totalMeasurements).toBe(expected.measurementCount);
      }
      if (expected.validMeasurements !== undefined) {
        expect(metrics.validMeasurements).toBe(expected.validMeasurements);
      }
      if (expected.avg24hSystolic !== undefined) {
        expect(Math.round(metrics.avg24hSystolic ?? Number.NaN)).toBe(expected.avg24hSystolic);
      }
      if (expected.avg24hDiastolic !== undefined) {
        expect(Math.round(metrics.avg24hDiastolic ?? Number.NaN)).toBe(expected.avg24hDiastolic);
      }
      if (expected.avgAwakeSystolic !== undefined) {
        expect(Math.round(metrics.awake?.avgSystolic ?? Number.NaN)).toBe(
          expected.avgAwakeSystolic,
        );
      }
      if (expected.avgAwakeDiastolic !== undefined) {
        expect(Math.round(metrics.awake?.avgDiastolic ?? Number.NaN)).toBe(
          expected.avgAwakeDiastolic,
        );
      }
      if (expected.avgSleepSystolic !== undefined) {
        expect(Math.round(metrics.sleep?.avgSystolic ?? Number.NaN)).toBe(
          expected.avgSleepSystolic,
        );
      }
      if (expected.avgSleepDiastolic !== undefined) {
        expect(Math.round(metrics.sleep?.avgDiastolic ?? Number.NaN)).toBe(
          expected.avgSleepDiastolic,
        );
      }
      if (expected.systolicDipping !== undefined) {
        expect(metrics.systolicNightDipping).toBeCloseTo(expected.systolicDipping, 1);
      }
      if (expected.diastolicDipping !== undefined) {
        expect(metrics.diastolicNightDipping).toBeCloseTo(expected.diastolicDipping, 1);
      }
    });
  }
});
