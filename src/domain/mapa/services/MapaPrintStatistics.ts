import type { MapaThresholds } from "../config/thresholds";
import { clockToMinutes } from "../import/awp/decoders/dateTime";
import type { MapaMeasurement } from "../import/awp/types";
import { calculatePressureLoad } from "../rules/pressureLoad";
import {
  isWithinSleepWindow,
  type SleepWindowInput,
} from "./MapaMetricsCalculator";

export interface ExtremeAt {
  value: number;
  at: Date;
}

export interface SeriesStats {
  max: ExtremeAt | null;
  min: ExtremeAt | null;
  mean: number | null;
  sd: number | null;
  se: number | null;
  cv: number | null;
}

export interface PeriodPrintStats {
  label: string;
  count: number;
  systolic: SeriesStats;
  diastolic: SeriesStats;
  heartRate: SeriesStats;
  meanArterialPressure: SeriesStats;
  pulsePressure: SeriesStats;
  systolicLoadPercent: number | null;
  diastolicLoadPercent: number | null;
  systolicThreshold: number;
  diastolicThreshold: number;
}

export interface MapaPrintStatistics {
  totalAttempts: number;
  validCount: number;
  validPercentage: number | null;
  examStart: Date | null;
  examEnd: Date | null;
  durationLabel: string | null;
  overall: PeriodPrintStats;
  awake: PeriodPrintStats | null;
  sleep: PeriodPrintStats | null;
  avg24hSystolic: number | null;
  avg24hDiastolic: number | null;
  awakeAvgSystolic: number | null;
  awakeAvgDiastolic: number | null;
  sleepAvgSystolic: number | null;
  sleepAvgDiastolic: number | null;
  awakeSystolicLoad: number | null;
  awakeDiastolicLoad: number | null;
  sleepSystolicLoad: number | null;
  sleepDiastolicLoad: number | null;
  systolicNightDipping: number | null;
  diastolicNightDipping: number | null;
  peakSystolic: ExtremeAt | null;
  peakDiastolic: ExtremeAt | null;
  troughSystolic: ExtremeAt | null;
  troughDiastolic: ExtremeAt | null;
  avgHeartRateAwake: number | null;
  avgHeartRateSleep: number | null;
  avgPulsePressureAwake: number | null;
  avgPulsePressureSleep: number | null;
  cvOverallSystolic: number | null;
  cvOverallDiastolic: number | null;
  cvAwakeSystolic: number | null;
  cvAwakeDiastolic: number | null;
  cvSleepSystolic: number | null;
  cvSleepDiastolic: number | null;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return values.length === 1 ? 0 : null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return round(Math.sqrt(variance), 1);
}

function seriesStats(
  items: Array<{ value: number; at: Date }>,
): SeriesStats {
  if (items.length === 0) {
    return { max: null, min: null, mean: null, sd: null, se: null, cv: null };
  }

  let max = items[0];
  let min = items[0];
  for (const item of items) {
    if (item.value > max.value) max = item;
    if (item.value < min.value) min = item;
  }

  const values = items.map((item) => item.value);
  const avg = mean(values);
  const sd = stdDev(values);
  const se =
    sd == null || values.length === 0 ? null : round(sd / Math.sqrt(values.length), 1);
  const cv = avg == null || avg === 0 || sd == null ? null : round((sd / avg) * 100, 1);

  return {
    max: { value: max.value, at: max.at },
    min: { value: min.value, at: min.at },
    mean: avg,
    sd,
    se,
    cv,
  };
}

function mapOf(measurement: MapaMeasurement): number {
  if (
    measurement.meanArterialPressure != null &&
    Number.isFinite(measurement.meanArterialPressure)
  ) {
    return measurement.meanArterialPressure;
  }
  return round((measurement.systolic + 2 * measurement.diastolic) / 3, 1);
}

function dipping(awake?: number | null, sleep?: number | null): number | null {
  if (awake == null || sleep == null || awake === 0) return null;
  return round(((awake - sleep) / awake) * 100, 1);
}

function formatDuration(start: Date, end: Date): string {
  const ms = Math.max(0, end.getTime() - start.getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildPeriodStats(
  label: string,
  measurements: MapaMeasurement[],
  systolicThreshold: number,
  diastolicThreshold: number,
  debugPeriod: "overall" | "awake" | "sleep",
): PeriodPrintStats {
  const systolic = seriesStats(
    measurements.map((measurement) => ({
      value: measurement.systolic,
      at: measurement.measuredAt,
    })),
  );
  const diastolic = seriesStats(
    measurements.map((measurement) => ({
      value: measurement.diastolic,
      at: measurement.measuredAt,
    })),
  );
  const heartRate = seriesStats(
    measurements
      .filter(
        (measurement) =>
          measurement.heartRate != null && Number.isFinite(measurement.heartRate),
      )
      .map((measurement) => ({
        value: measurement.heartRate as number,
        at: measurement.measuredAt,
      })),
  );
  const meanArterialPressure = seriesStats(
    measurements.map((measurement) => ({
      value: mapOf(measurement),
      at: measurement.measuredAt,
    })),
  );
  const pulsePressure = seriesStats(
    measurements.map((measurement) => ({
      value: measurement.systolic - measurement.diastolic,
      at: measurement.measuredAt,
    })),
  );

  return {
    label,
    count: measurements.length,
    systolic,
    diastolic,
    heartRate,
    meanArterialPressure,
    pulsePressure,
    systolicLoadPercent: calculatePressureLoad(
      measurements.map((measurement) => measurement.systolic),
      systolicThreshold,
      { period: debugPeriod, type: "systolic" },
    ).percent,
    diastolicLoadPercent: calculatePressureLoad(
      measurements.map((measurement) => measurement.diastolic),
      diastolicThreshold,
      { period: debugPeriod, type: "diastolic" },
    ).percent,
    systolicThreshold,
    diastolicThreshold,
  };
}

function resolveWindow(window?: SleepWindowInput | null): SleepWindowInput | null {
  if (!window) return null;
  const start = clockToMinutes(window.start);
  const end = clockToMinutes(window.end);
  if (start === undefined || end === undefined || start === end) return null;
  return window;
}

export function buildMapaPrintStatistics(
  measurements: MapaMeasurement[],
  thresholds: MapaThresholds,
  sleepWindow?: SleepWindowInput | null,
): MapaPrintStatistics {
  const valid = measurements.filter((measurement) => measurement.valid);
  const timestamps = measurements
    .map((measurement) => measurement.measuredAt.getTime())
    .filter((time) => !Number.isNaN(time));
  const examStart = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
  const examEnd = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

  const usableWindow = resolveWindow(sleepWindow);
  let awakeMeasurements: MapaMeasurement[] = [];
  let sleepMeasurements: MapaMeasurement[] = [];
  if (usableWindow) {
    for (const measurement of valid) {
      const asleep = isWithinSleepWindow(measurement.measuredAt, usableWindow);
      if (asleep === undefined) continue;
      (asleep ? sleepMeasurements : awakeMeasurements).push(measurement);
    }
  }

  const overall = buildPeriodStats(
    "Geral",
    valid,
    thresholds.full24Hours.systolic,
    thresholds.full24Hours.diastolic,
    "overall",
  );
  const awake =
    usableWindow && awakeMeasurements.length > 0
      ? buildPeriodStats(
          "Vigília",
          awakeMeasurements,
          thresholds.awake.systolic,
          thresholds.awake.diastolic,
          "awake",
        )
      : null;
  const sleep =
    usableWindow && sleepMeasurements.length > 0
      ? buildPeriodStats(
          "Sono",
          sleepMeasurements,
          thresholds.sleep.systolic,
          thresholds.sleep.diastolic,
          "sleep",
        )
      : null;

  return {
    totalAttempts: measurements.length,
    validCount: valid.length,
    validPercentage:
      measurements.length === 0
        ? null
        : round((valid.length / measurements.length) * 100, 1),
    examStart,
    examEnd,
    durationLabel:
      examStart && examEnd ? formatDuration(examStart, examEnd) : null,
    overall,
    awake,
    sleep,
    avg24hSystolic: overall.systolic.mean,
    avg24hDiastolic: overall.diastolic.mean,
    awakeAvgSystolic: awake?.systolic.mean ?? null,
    awakeAvgDiastolic: awake?.diastolic.mean ?? null,
    sleepAvgSystolic: sleep?.systolic.mean ?? null,
    sleepAvgDiastolic: sleep?.diastolic.mean ?? null,
    awakeSystolicLoad: awake?.systolicLoadPercent ?? null,
    awakeDiastolicLoad: awake?.diastolicLoadPercent ?? null,
    sleepSystolicLoad: sleep?.systolicLoadPercent ?? null,
    sleepDiastolicLoad: sleep?.diastolicLoadPercent ?? null,
    systolicNightDipping: dipping(awake?.systolic.mean, sleep?.systolic.mean),
    diastolicNightDipping: dipping(awake?.diastolic.mean, sleep?.diastolic.mean),
    peakSystolic: overall.systolic.max,
    peakDiastolic: overall.diastolic.max,
    troughSystolic: overall.systolic.min,
    troughDiastolic: overall.diastolic.min,
    avgHeartRateAwake: awake?.heartRate.mean ?? null,
    avgHeartRateSleep: sleep?.heartRate.mean ?? null,
    avgPulsePressureAwake: awake?.pulsePressure.mean ?? null,
    avgPulsePressureSleep: sleep?.pulsePressure.mean ?? null,
    cvOverallSystolic: overall.systolic.cv,
    cvOverallDiastolic: overall.diastolic.cv,
    cvAwakeSystolic: awake?.systolic.cv ?? null,
    cvAwakeDiastolic: awake?.diastolic.cv ?? null,
    cvSleepSystolic: sleep?.systolic.cv ?? null,
    cvSleepDiastolic: sleep?.diastolic.cv ?? null,
  };
}
