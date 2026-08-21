import type { StructuredReportSections } from "./types/report";

/** Tópicos do laudo, na ordem de exibição, com rótulo e campo no banco. */
export const REPORT_TOPICS = [
  {
    key: "medications",
    label: "Medicações atuais",
    field: "generatedMedications",
  },
  {
    key: "technicalComments",
    label: "Comentários sobre o desempenho técnico",
    field: "generatedTechnicalComments",
  },
  {
    key: "averagePressure",
    label: "Médias pressóricas",
    field: "generatedResults",
  },
  {
    key: "pressureLoad",
    label: "Cargas pressóricas",
    field: "generatedPressureLoad",
  },
  {
    key: "pressurePeaks",
    label: "Picos pressóricos",
    field: "generatedPressurePeaks",
  },
  {
    key: "nightDipping",
    label: "Descenso pressórico no sono",
    field: "generatedNightDipping",
  },
  {
    key: "specialSituations",
    label: "Situações especiais",
    field: "generatedSpecialSituations",
  },
  {
    key: "conclusion",
    label: "Interpretação dos resultados",
    field: "generatedConclusion",
  },
] as const satisfies ReadonlyArray<{
  key: keyof StructuredReportSections;
  label: string;
  field: string;
}>;

export type ReportTopicKey = (typeof REPORT_TOPICS)[number]["key"];

/** Prefixo dos campos de feedback por tópico no formulário de reprovação. */
export const TOPIC_FEEDBACK_PREFIX = "feedback_";

/** Lê o JSON de pendências por tópico salvo no laudo. */
export function parseTopicFeedback(
  raw: string | null | undefined,
): Partial<Record<ReportTopicKey, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<ReportTopicKey, string>> = {};
    for (const topic of REPORT_TOPICS) {
      const value = parsed[topic.key];
      if (typeof value === "string" && value.trim()) {
        out[topic.key] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}
