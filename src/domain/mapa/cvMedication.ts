import type { TriStateClinicalFlag } from "./types/clinical";

/** Anti-hipertensivo / medicação de efeito cardiovascular que reduz a PA. */
export function isOnCardiovascularMedication(data: {
  cvMedicationStatus?: TriStateClinicalFlag | null;
  currentMedications?: string | null;
}): boolean {
  return data.cvMedicationStatus === "YES";
}
