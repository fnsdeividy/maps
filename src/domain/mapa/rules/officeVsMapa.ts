import type { OfficeVsMapaClassification } from "../types/clinical";
import type { PressurePair } from "../config/thresholds";
import { isPressureElevated } from "./averagePressure";

export function classifyOfficeVsMapa(input: {
  officeSystolic: number;
  officeDiastolic: number;
  mapaSystolic: number;
  mapaDiastolic: number;
  officeThresholds: PressurePair;
  mapaThresholds: PressurePair;
}): OfficeVsMapaClassification {
  const officeElevated = isPressureElevated(
    input.officeSystolic,
    input.officeDiastolic,
    input.officeThresholds,
  );
  const mapaElevated = isPressureElevated(
    input.mapaSystolic,
    input.mapaDiastolic,
    input.mapaThresholds,
  );

  if (!officeElevated && !mapaElevated) return "NORMOTENSION";
  if (officeElevated && mapaElevated) return "SUSTAINED_HYPERTENSION";
  if (officeElevated && !mapaElevated) return "WHITE_COAT_HYPERTENSION";
  return "MASKED_HYPERTENSION";
}
