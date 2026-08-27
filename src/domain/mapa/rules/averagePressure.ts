import type { AveragePressureClass } from "../types/clinical";
import type { PressurePair } from "../config/thresholds";

export type AveragePressureClassExtended =
  | AveragePressureClass
  | "BOTH_SIGNIFICANTLY_ELEVATED"
  | "SYS_SIGNIFICANTLY_ELEVATED"
  | "DIA_SIGNIFICANTLY_ELEVATED";

type ComponentLevel = "NORMAL" | "ELEVATED" | "SIGNIFICANT";

/**
 * Médias de PA no laudo usam mmHg inteiro — o mesmo número do quadro
 * "Resultado dos exames". Sem isso, 134,7 aparece como 135 e a regra
 * trata como normal (< 135).
 */
export function roundMmHg(value: number): number {
  return Math.round(value);
}

function componentLevel(
  value: number,
  elevatedThreshold: number,
  significantThreshold?: number,
): ComponentLevel {
  const mmHg = roundMmHg(value);
  if (significantThreshold != null && mmHg >= significantThreshold) {
    return "SIGNIFICANT";
  }
  if (mmHg >= elevatedThreshold) return "ELEVATED";
  return "NORMAL";
}

export function classifyAveragePressure(
  systolic: number,
  diastolic: number,
  threshold: PressurePair,
): AveragePressureClass {
  const sysElevated = roundMmHg(systolic) >= threshold.systolic;
  const diaElevated = roundMmHg(diastolic) >= threshold.diastolic;

  if (sysElevated && diaElevated) return "BOTH_ELEVATED";
  if (sysElevated) return "SYS_ELEVATED";
  if (diaElevated) return "DIA_ELEVATED";
  return "BOTH_NORMAL";
}

/** Classificação 24h com suporte a “significativamente elevada”. */
export function classifyAveragePressure24h(
  systolic: number,
  diastolic: number,
  elevated: PressurePair,
  significant: PressurePair | null,
): AveragePressureClassExtended {
  const sys = componentLevel(
    systolic,
    elevated.systolic,
    significant?.systolic,
  );
  const dia = componentLevel(
    diastolic,
    elevated.diastolic,
    significant?.diastolic,
  );

  if (sys === "NORMAL" && dia === "NORMAL") return "BOTH_NORMAL";

  if (sys !== "NORMAL" && dia !== "NORMAL") {
    if (sys === "SIGNIFICANT" && dia === "SIGNIFICANT") {
      return "BOTH_SIGNIFICANTLY_ELEVATED";
    }
    return "BOTH_ELEVATED";
  }

  if (sys !== "NORMAL") {
    return sys === "SIGNIFICANT" ? "SYS_SIGNIFICANTLY_ELEVATED" : "SYS_ELEVATED";
  }

  return dia === "SIGNIFICANT" ? "DIA_SIGNIFICANTLY_ELEVATED" : "DIA_ELEVATED";
}

export function isPressureElevated(
  systolic: number,
  diastolic: number,
  threshold: PressurePair,
): boolean {
  return (
    roundMmHg(systolic) >= threshold.systolic ||
    roundMmHg(diastolic) >= threshold.diastolic
  );
}
