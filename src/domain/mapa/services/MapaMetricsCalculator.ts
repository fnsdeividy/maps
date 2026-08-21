import { mapaThresholds, type MapaThresholds, type PressurePair } from "../config/thresholds";
import { clockToMinutes } from "../import/awp/decoders/dateTime";
import type { MapaMeasurement } from "../import/awp/types";

export interface SleepWindowInput {
  /** "HH:MM" no fuso do equipamento. */
  start: string;
  end: string;
}

export interface PeriodMetrics {
  count: number;
  avgSystolic: number;
  avgDiastolic: number;
  /** Percentual de medições do período acima do corte configurado. */
  systolicLoad: number | null;
  diastolicLoad: number | null;
}

export interface PeakMetric {
  value: number;
  at: Date;
}

export interface MapaMetrics {
  totalMeasurements: number;
  validMeasurements: number;
  invalidMeasurements: number;
  validMeasurementsPercentage: number | null;

  examStart: Date | null;
  examEnd: Date | null;

  avg24hSystolic: number | null;
  avg24hDiastolic: number | null;

  minSystolic: number | null;
  maxSystolic: number | null;
  minDiastolic: number | null;
  maxDiastolic: number | null;

  avgHeartRate: number | null;
  minHeartRate: number | null;
  maxHeartRate: number | null;

  awake: PeriodMetrics | null;
  sleep: PeriodMetrics | null;

  systolicNightDipping: number | null;
  diastolicNightDipping: number | null;

  peakSystolic: PeakMetric | null;
  peakDiastolic: PeakMetric | null;

  /** Cortes usados nas cargas, para exibir a origem do número na interface. */
  loadBasis: { awake: PressurePair; sleep: PressurePair } | null;
  sleepWindow: SleepWindowInput | null;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[], digits = 1): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return round(sum / values.length, digits);
}

function percentAbove(values: number[], threshold: number): number | null {
  if (values.length === 0) return null;
  const above = values.filter((value) => value >= threshold).length;
  return round((above / values.length) * 100, 1);
}

/**
 * Um horário pertence ao sono quando cai no intervalo [início, fim), tratando a
 * virada da meia-noite. Fora disso é vigília.
 */
export function isWithinSleepWindow(
  measuredAt: Date,
  window: SleepWindowInput,
): boolean | undefined {
  const start = clockToMinutes(window.start);
  const end = clockToMinutes(window.end);
  if (start === undefined || end === undefined || start === end) return undefined;

  const minutes = measuredAt.getHours() * 60 + measuredAt.getMinutes();
  return start < end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

/**
 * Calcula todas as métricas do MAPA a partir das medições lidas do arquivo.
 *
 * Só entram no cálculo medições marcadas como válidas, e todo número sai daqui
 * por aritmética — nada é estimado, nem enviado para IA. Períodos de vigília e
 * sono exigem uma janela explícita: sem ela, as médias por período ficam nulas
 * em vez de assumir um 22h–06h arbitrário.
 */
export class MapaMetricsCalculator {
  constructor(private readonly thresholds: MapaThresholds = mapaThresholds) {}

  calculate(
    measurements: MapaMeasurement[],
    sleepWindow?: SleepWindowInput | null,
  ): MapaMetrics {
    const valid = measurements.filter((measurement) => measurement.valid);
    const systolics = valid.map((measurement) => measurement.systolic);
    const diastolics = valid.map((measurement) => measurement.diastolic);
    const heartRates = valid
      .map((measurement) => measurement.heartRate)
      .filter((value): value is number => value !== undefined && Number.isFinite(value));
    const timestamps = measurements
      .map((measurement) => measurement.measuredAt.getTime())
      .filter((time) => !Number.isNaN(time));

    const usableWindow = this.resolveWindow(sleepWindow);
    const partition = usableWindow ? this.partition(valid, usableWindow) : null;

    const awake = partition
      ? this.periodMetrics(partition.awake, this.thresholds.awake)
      : null;
    const sleep = partition
      ? this.periodMetrics(partition.sleep, this.thresholds.sleep)
      : null;

    return {
      totalMeasurements: measurements.length,
      validMeasurements: valid.length,
      invalidMeasurements: measurements.length - valid.length,
      validMeasurementsPercentage:
        measurements.length === 0
          ? null
          : round((valid.length / measurements.length) * 100, 1),

      examStart: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      examEnd: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,

      avg24hSystolic: average(systolics),
      avg24hDiastolic: average(diastolics),

      minSystolic: systolics.length > 0 ? Math.min(...systolics) : null,
      maxSystolic: systolics.length > 0 ? Math.max(...systolics) : null,
      minDiastolic: diastolics.length > 0 ? Math.min(...diastolics) : null,
      maxDiastolic: diastolics.length > 0 ? Math.max(...diastolics) : null,

      avgHeartRate: average(heartRates),
      minHeartRate: heartRates.length > 0 ? Math.min(...heartRates) : null,
      maxHeartRate: heartRates.length > 0 ? Math.max(...heartRates) : null,

      awake,
      sleep,

      systolicNightDipping: this.dipping(awake?.avgSystolic, sleep?.avgSystolic),
      diastolicNightDipping: this.dipping(awake?.avgDiastolic, sleep?.avgDiastolic),

      peakSystolic: this.peak(valid, (measurement) => measurement.systolic),
      peakDiastolic: this.peak(valid, (measurement) => measurement.diastolic),

      loadBasis: { awake: this.thresholds.awake, sleep: this.thresholds.sleep },
      sleepWindow: usableWindow,
    };
  }

  private resolveWindow(window?: SleepWindowInput | null): SleepWindowInput | null {
    if (!window) return null;
    const start = clockToMinutes(window.start);
    const end = clockToMinutes(window.end);
    if (start === undefined || end === undefined || start === end) return null;
    return window;
  }

  private partition(measurements: MapaMeasurement[], window: SleepWindowInput) {
    const awake: MapaMeasurement[] = [];
    const sleep: MapaMeasurement[] = [];
    for (const measurement of measurements) {
      const asleep = isWithinSleepWindow(measurement.measuredAt, window);
      if (asleep === undefined) continue;
      (asleep ? sleep : awake).push(measurement);
    }
    return { awake, sleep };
  }

  private periodMetrics(
    measurements: MapaMeasurement[],
    threshold: PressurePair,
  ): PeriodMetrics | null {
    if (measurements.length === 0) return null;
    const systolics = measurements.map((measurement) => measurement.systolic);
    const diastolics = measurements.map((measurement) => measurement.diastolic);

    return {
      count: measurements.length,
      avgSystolic: average(systolics) as number,
      avgDiastolic: average(diastolics) as number,
      systolicLoad: percentAbove(systolics, threshold.systolic),
      diastolicLoad: percentAbove(diastolics, threshold.diastolic),
    };
  }

  private dipping(awake?: number, sleep?: number): number | null {
    if (awake === undefined || sleep === undefined || awake === 0) return null;
    return round(((awake - sleep) / awake) * 100, 1);
  }

  private peak(
    measurements: MapaMeasurement[],
    pick: (measurement: MapaMeasurement) => number,
  ): PeakMetric | null {
    let best: PeakMetric | null = null;
    for (const measurement of measurements) {
      const value = pick(measurement);
      if (!Number.isFinite(value)) continue;
      if (!best || value > best.value) {
        best = { value, at: measurement.measuredAt };
      }
    }
    return best;
  }
}
