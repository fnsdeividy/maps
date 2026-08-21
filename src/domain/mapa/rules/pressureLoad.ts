export function isLoadElevated(
  percent: number | null | undefined,
  elevatedPercent: number,
): boolean {
  if (percent == null) return false;
  return percent >= elevatedPercent;
}

export function roundPercent(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
