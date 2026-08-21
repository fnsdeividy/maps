export type NightDipClass = "ABSENT" | "ATTENUATED" | "NORMAL" | "ACCENTUATED";

export type NightDippingThresholds = {
  absentMax: number;
  attenuatedMax: number;
  normalMax: number;
};

export function classifyNightDip(
  percent: number,
  thresholds: NightDippingThresholds,
): NightDipClass {
  if (percent <= thresholds.absentMax) return "ABSENT";
  if (percent < thresholds.attenuatedMax) return "ATTENUATED";
  if (percent <= thresholds.normalMax) return "NORMAL";
  return "ACCENTUATED";
}
