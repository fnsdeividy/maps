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
  { key: "pregnancyStatus", label: "Gestante", name: "pregnancyStatus" },
  { key: "alcoholUse", label: "Uso de álcool", name: "alcoholUse" },
  { key: "smoking", label: "Tabagismo", name: "smoking" },
  { key: "insomnia", label: "Insônia", name: "insomnia" },
  { key: "caffeineUse", label: "Uso de cafeína", name: "caffeineUse" },
] as const;

export type SpecialFlagKey = (typeof SPECIAL_FLAG_FIELDS)[number]["key"];

export type SpecialFlags = Record<SpecialFlagKey, TriStateFlag>;

export function readRequiredSpecialFlags(formData: FormData): SpecialFlags | null {
  const flags = {} as SpecialFlags;
  for (const field of SPECIAL_FLAG_FIELDS) {
    const value = parseTriStateFlag(formData.get(field.name));
    if (!value) return null;
    flags[field.key] = value;
  }
  return flags;
}

export function summarizeSpecialFlags(flags: SpecialFlags): string {
  return SPECIAL_FLAG_FIELDS.map(
    (field) => `${field.label}: ${triStateLabel(flags[field.key])}`,
  ).join(". ");
}
