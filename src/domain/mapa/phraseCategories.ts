import type { PhraseCategory } from "./types/clinical";

/** Categorias de frases, na ordem de exibição, com rótulo amigável. */
export const PHRASE_CATEGORIES: Array<{ value: PhraseCategory; label: string }> = [
  { value: "MEDICATION", label: "Medicações" },
  { value: "TECHNICAL_QUALITY", label: "Comentários técnicos" },
  { value: "AVERAGE_PRESSURE", label: "Médias pressóricas" },
  { value: "PRESSURE_LOAD", label: "Cargas pressóricas" },
  { value: "PRESSURE_PEAK", label: "Picos pressóricos" },
  { value: "NIGHT_DIPPING", label: "Descenso noturno" },
  { value: "SPECIAL_SITUATION", label: "Situações especiais" },
  { value: "GENERAL_CONSIDERATION", label: "Considerações clínicas" },
  { value: "CONCLUSION", label: "Conclusão / Interpretação" },
];

export const PHRASE_CATEGORY_LABEL: Record<PhraseCategory, string> =
  Object.fromEntries(
    PHRASE_CATEGORIES.map((c) => [c.value, c.label]),
  ) as Record<PhraseCategory, string>;

export function isPhraseCategory(value: string): value is PhraseCategory {
  return PHRASE_CATEGORIES.some((c) => c.value === value);
}
