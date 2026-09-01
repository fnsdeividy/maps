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

function isExamConclusionPhrase(text: string): boolean {
  return /^exame com valores compatíveis/i.test(text.trim());
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

function diagnosisKey(text: string): string | null {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (/avental branco/.test(normalized)) return "white-coat";
  if (/mascarada/.test(normalized)) return "masked";
  if (/sustentada/.test(normalized)) return "sustained";
  if (/controlada/.test(normalized)) return "controlled";
  if (/normotensao/.test(normalized)) return "normotension";
  return null;
}

export function phrasesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.;])\s+(?=[A-ZÀ-Ú])/u))
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Remove o diagnóstico duplicado (consultório × MAPA + “Exame com…”) e
 * junta o restante em parágrafos.
 */
export function composeInterpretationPhrases(phrases: string[]): string {
  const cleaned = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  const hasExamConclusion = cleaned.some(isExamConclusionPhrase);
  const seenDiagnosis = new Set<string>();
  const kept: string[] = [];

  for (const phrase of cleaned) {
    if (isCvMedicationReminder(phrase)) continue;
    if (hasExamConclusion && isOfficeVsMapaDiagnosis(phrase)) continue;
    const key = diagnosisKey(phrase);
    if (key && (isOfficeVsMapaDiagnosis(phrase) || isExamConclusionPhrase(phrase))) {
      if (seenDiagnosis.has(key)) continue;
      seenDiagnosis.add(key);
    }
    kept.push(phrase);
  }

  return kept.join("\n\n");
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
