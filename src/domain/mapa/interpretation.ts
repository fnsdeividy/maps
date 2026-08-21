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

function phrasesOf(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+(?=[A-ZÀ-Ú])/u)
    .map((part) => part.trim())
    .filter(Boolean);
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

  if (!conclusionText) return generalText;
  if (!generalText) return conclusionText;

  const extras = phrasesOf(generalText).filter(
    (phrase) => !isOfficeVsMapaDiagnosis(phrase),
  );
  return [conclusionText, ...extras].filter(Boolean).join(" ");
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
    (phrase) => !isOfficeVsMapaDiagnosis(phrase),
  );
}
