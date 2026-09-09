export type PressureLoadResult = {
  validReadings: number;
  aboveThreshold: number;
  threshold: number;
  percent: number | null;
};

export function isLoadElevated(
  percent: number | null | undefined,
  elevatedPercent: number,
): boolean {
  if (percent == null) return false;
  return percent >= elevatedPercent;
}

export function pressureLoadCuts(
  thresholds: {
    awakeElevatedPercent?: number;
    sleepElevatedPercent?: number;
  } | null | undefined,
): { awake: number; sleep: number } {
  return {
    awake: thresholds?.awakeElevatedPercent ?? 40,
    sleep: thresholds?.sleepElevatedPercent ?? 50,
  };
}

export function roundPercent(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Única fonte da verdade da carga pressórica:
 * (medições do conjunto ≥ limiar mmHg) / (medições válidas do conjunto) * 100
 */
export function calculatePressureLoad(
  values: number[],
  threshold: number,
  debug?: { period: string; type: string },
): PressureLoadResult {
  const validReadings = values.length;
  const aboveThreshold = values.filter((value) => value >= threshold).length;
  const percent =
    validReadings === 0
      ? null
      : roundPercent((aboveThreshold / validReadings) * 100);

  if (debug && process.env.MAPA_CALCULATION_DEBUG === "1") {
    console.info(
      "[MAPA_CALCULATION]",
      JSON.stringify({
        period: debug.period,
        type: debug.type,
        validReadings,
        aboveThreshold,
        threshold,
        percentage: percent,
      }),
    );
  }

  return { validReadings, aboveThreshold, threshold, percent };
}
