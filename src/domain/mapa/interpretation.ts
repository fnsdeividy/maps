/** Frase-padrão quando o motor não preencheu o tópico. */
export const EMPTY_REPORT_TEXT = "Não informado.";

export function isFilledReportText(text?: string | null): text is string {
  const value = text?.trim();
  return Boolean(value) && value !== EMPTY_REPORT_TEXT;
}

/** Frase consultório × MAPA — o diagnóstico já vai na interpretação. */
function isOfficeVsMapaDiagnosis(text: string): boolean {
  return /valores das médias pressóricas/i.test(text);
}

/** Lembrete clínico: a medicação entra na classificação, não no texto do laudo. */
export function isCvMedicationReminder(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return /considerar o uso de medicamentos de efeito cardiovascular/.test(
    normalized,
  );
}

/** Fallback do motor quando a frase está inativa (ex.: MASKED_HYPERTENSION). */
export function isEngineFallbackToken(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (value === "NORMOTENSION") return true;
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value);
}

export function stripEngineFallbackTokens(text: string): string {
  return text
    .replace(/\bNORMOTENSION\b/g, " ")
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function phrasesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.;])\s+(?=[A-ZÀ-Ú])/u))
    .map((part) => stripEngineFallbackTokens(part.trim()))
    .filter(Boolean);
}

/**
 * Remove apenas conteúdo técnico que não pode aparecer no laudo. As frases
 * clínicas escolhidas pelo médico são preservadas para edição individual.
 */
export function composeInterpretationPhrases(phrases: string[]): string {
  const cleaned = phrases
    .map((phrase) => stripEngineFallbackTokens(phrase.trim()))
    .filter(Boolean);
  return cleaned
    .filter(
      (phrase) =>
        !isEngineFallbackToken(phrase) && !isCvMedicationReminder(phrase),
    )
    .join("\n\n");
}

/**
 * Texto único da interpretação: conclusão diagnóstica, sem repetir a
 * consideração consultório × MAPA. Se a conclusão estiver vazia, usa a
 * consideração (laudos antigos).
 */
export function interpretationDisplayText(
  generalConsiderations?: string | null,
  conclusion?: string | null,
): string {
  const conclusionText = isFilledReportText(conclusion) ? conclusion.trim() : "";
  const generalText = isFilledReportText(generalConsiderations)
    ? generalConsiderations.trim()
    : "";

  if (!conclusionText && !generalText) return "";
  if (!conclusionText) return composeInterpretationPhrases(phrasesOf(generalText));
  if (!generalText) return composeInterpretationPhrases(phrasesOf(conclusionText));

  return composeInterpretationPhrases([
    ...phrasesOf(conclusionText),
    ...phrasesOf(generalText),
  ]);
}

/** Considerações que não são o diagnóstico já mostrado na interpretação. */
export function hasStandaloneConsiderations(
  generalConsiderations?: string | null,
  conclusion?: string | null,
): boolean {
  const generalText = isFilledReportText(generalConsiderations)
    ? generalConsiderations.trim()
    : "";
  if (!generalText) return false;
  if (!isFilledReportText(conclusion)) return false;
  return phrasesOf(generalText).some(
    (phrase) =>
      !isOfficeVsMapaDiagnosis(phrase) && !isCvMedicationReminder(phrase),
  );
}
