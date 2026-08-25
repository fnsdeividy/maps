/** Resposta obrigatória para situações especiais. */
export type TriStateFlag = "YES" | "NO" | "UNKNOWN";

export const TRI_STATE_VALUES = ["YES", "NO", "UNKNOWN"] as const;

export function isTriStateFlag(value: unknown): value is TriStateFlag {
  return value === "YES" || value === "NO" || value === "UNKNOWN";
}

export function parseTriStateFlag(value: FormDataEntryValue | null): TriStateFlag | null {
  if (typeof value !== "string") return null;
  return isTriStateFlag(value) ? value : null;
}

export function triStateLabel(value: TriStateFlag): string {
  if (value === "YES") return "sim";
  if (value === "NO") return "não";
  return "não informado";
}

export const SPECIAL_FLAG_FIELDS = [
  { key: "pregnancyStatus", label: "Gestante", name: "pregnancyStatus", group: "context" },
  { key: "alcoholUse", label: "Uso de bebidas alcoólicas", name: "alcoholUse", group: "context" },
  { key: "smoking", label: "Tabagismo", name: "smoking", group: "context" },
  { key: "caffeineUse", label: "Uso de cafeína", name: "caffeineUse", group: "context" },
  { key: "headache", label: "Dores de cabeça", name: "headache", group: "symptom" },
  { key: "insomnia", label: "Insônia", name: "insomnia", group: "symptom" },
  { key: "chestPain", label: "Dores no peito", name: "chestPain", group: "symptom" },
  { key: "dyspnea", label: "Falta de ar", name: "dyspnea", group: "symptom" },
  { key: "dizziness", label: "Tontura", name: "dizziness", group: "symptom" },
] as const;

export type SpecialFlagKey = (typeof SPECIAL_FLAG_FIELDS)[number]["key"];

export type SpecialFlags = Record<SpecialFlagKey, TriStateFlag> & {
  cvMedicationStatus: TriStateFlag;
};

export function readRequiredSpecialFlags(formData: FormData): SpecialFlags | null {
  const flags = {} as Record<SpecialFlagKey, TriStateFlag>;
  for (const field of SPECIAL_FLAG_FIELDS) {
    const value = parseTriStateFlag(formData.get(field.name));
    if (!value) return null;
    flags[field.key] = value;
  }
  const cvMedicationStatus = parseTriStateFlag(formData.get("cvMedicationStatus"));
  if (!cvMedicationStatus) return null;
  return { ...flags, cvMedicationStatus };
}

export function summarizeSpecialFlags(flags: SpecialFlags): string {
  const special = SPECIAL_FLAG_FIELDS.map(
    (field) => `${field.label}: ${triStateLabel(flags[field.key])}`,
  ).join(". ");
  return `${special}. Medicação de efeito cardiovascular: ${triStateLabel(flags.cvMedicationStatus)}`;
}
