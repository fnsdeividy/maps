import type { MapaMeasurement } from "./types";

export const DISCARDED_BY_REVIEW_REASON = "Desconsiderada pelo revisor";

/** Marca ou restaura uma medição desconsiderada pelo revisor (não mexe em inválidas do aparelho). */
export function applyMeasurementDiscard(
  measurement: MapaMeasurement,
  discarded: boolean,
): MapaMeasurement {
  if (discarded) {
    if (!measurement.valid && !measurement.discarded) return measurement;
    return {
      ...measurement,
      valid: false,
      discarded: true,
      invalidReason: DISCARDED_BY_REVIEW_REASON,
    };
  }
  if (!measurement.discarded) return measurement;
  return {
    ...measurement,
    valid: true,
    discarded: false,
    invalidReason: undefined,
  };
}

export function applyMeasurementDiscards(
  measurements: MapaMeasurement[],
  discardedIndexes: Iterable<number>,
): MapaMeasurement[] {
  const discarded = new Set(discardedIndexes);
  return measurements.map((measurement) =>
    discarded.has(measurement.index)
      ? applyMeasurementDiscard(measurement, true)
      : measurement,
  );
}
