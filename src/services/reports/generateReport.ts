import { prisma } from "@/lib/prisma";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { ReportPhraseResolver } from "@/domain/mapa/services/ReportPhraseResolver";
import { DeterministicReportBuilder } from "@/domain/mapa/services/DeterministicReportBuilder";
import { computeValidMeasurementsPercentage } from "@/domain/mapa/rules/technicalQuality";
import type { MapaClinicalData, SpecialSituationCode } from "@/domain/mapa/types/clinical";
import type { StructuredReportSections } from "@/domain/mapa/types/report";
import {
  AiPhraseSelectionService,
  AI_SELECTION_PROMPT_VERSION,
  buildCandidates,
  mergeSelection,
  type SelectionByCategory,
} from "@/services/ai/AiPhraseSelectionService";
import { estimateCost } from "@/services/ai/pricing";
import { logReportEvent } from "@/services/audit/log";
import { getClinicSettings } from "@/services/settings/clinicSettings";
import { deserializeParseResult } from "@/services/imports/awpParseResultCodec";
import { formatTime } from "@/lib/dates";

function toClinical(report: {
  currentMedications: string;
  officeSystolicPressure: number | null;
  officeDiastolicPressure: number | null;
  officeHeartRate: number | null;
  pregnancy: boolean;
  pregnancyMonths: number | null;
  pregnancyStatus: string;
  alcoholUse: string;
  smoking: string;
  insomnia: string;
  caffeineUse: string;
  totalMeasurements: number | null;
  validMeasurements: number | null;
  avg24hSystolic: number | null;
  avg24hDiastolic: number | null;
  awakeSystolic: number | null;
  awakeDiastolic: number | null;
  sleepSystolic: number | null;
  sleepDiastolic: number | null;
  awakeSystolicLoad: number | null;
  awakeDiastolicLoad: number | null;
  sleepSystolicLoad: number | null;
  sleepDiastolicLoad: number | null;
  systolicNightDipping: number | null;
  diastolicNightDipping: number | null;
  peakAwake: boolean;
  peakSleep: boolean;
  peakMorning: boolean;
  peakWithHeartRateIncrease: boolean;
  peakPhysicalEmotionalStress: boolean;
  peakPressureNotes: string | null;
  specialSituations: string;
}): MapaClinicalData {
  let special: SpecialSituationCode[] = [];
  try {
    special = JSON.parse(report.specialSituations) as SpecialSituationCode[];
  } catch {
    special = [];
  }

  const asFlag = (value: string) =>
    value === "YES" || value === "NO" || value === "UNKNOWN" ? value : "UNKNOWN";

  return {
    ...report,
    pregnancyStatus: asFlag(report.pregnancyStatus),
    alcoholUse: asFlag(report.alcoholUse),
    smoking: asFlag(report.smoking),
    insomnia: asFlag(report.insomnia),
    caffeineUse: asFlag(report.caffeineUse),
    specialSituations: special,
  };
}

function sectionsToDb(sections: Partial<StructuredReportSections>) {
  return {
    ...(sections.medications != null
      ? { generatedMedications: sections.medications }
      : {}),
    ...(sections.technicalComments != null
      ? { generatedTechnicalComments: sections.technicalComments }
      : {}),
    ...(sections.averagePressure != null
      ? { generatedResults: sections.averagePressure }
      : {}),
    ...(sections.pressureLoad != null
      ? { generatedPressureLoad: sections.pressureLoad }
      : {}),
    ...(sections.pressurePeaks != null
      ? { generatedPressurePeaks: sections.pressurePeaks }
      : {}),
    ...(sections.nightDipping != null
      ? { generatedNightDipping: sections.nightDipping }
      : {}),
    ...(sections.specialSituations != null
      ? { generatedSpecialSituations: sections.specialSituations }
      : {}),
    ...(sections.generalConsiderations != null
      ? { generatedGeneralConsiderations: sections.generalConsiderations }
      : {}),
    ...(sections.conclusion != null
      ? { generatedConclusion: sections.conclusion }
      : {}),
  };
}

/** Resumo clínico compacto para orientar a seleção de frases pela IA. */
function buildClinicalContext(
  report: Parameters<typeof toClinical>[0],
  percentage: number | null,
): string {
  const parts: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    parts.push(`${label}: ${value}`);
  };

  add("Válidas %", percentage != null ? Math.round(percentage) : null);
  add("Médias 24h", numberPair(report.avg24hSystolic, report.avg24hDiastolic));
  add("Vigília", numberPair(report.awakeSystolic, report.awakeDiastolic));
  add("Sono", numberPair(report.sleepSystolic, report.sleepDiastolic));
  add(
    "Cargas vigília S/D",
    numberPair(report.awakeSystolicLoad, report.awakeDiastolicLoad),
  );
  add(
    "Cargas sono S/D",
    numberPair(report.sleepSystolicLoad, report.sleepDiastolicLoad),
  );
  add(
    "Descenso S/D",
    numberPair(report.systolicNightDipping, report.diastolicNightDipping),
  );
  add(
    "PA consultório",
    numberPair(report.officeSystolicPressure, report.officeDiastolicPressure),
  );

  return parts.join("; ") || "Sem dados numéricos disponíveis.";
}

function numberPair(a: number | null, b: number | null): string | null {
  if (a == null && b == null) return null;
  return `${a ?? "—"}/${b ?? "—"}`;
}

function isFilledSection(text?: string | null): boolean {
  const value = text?.trim();
  return Boolean(value) && value !== "Não informado.";
}

/**
 * Relaciona o pico pressórico ao horário do maior valor medido e ao que o
 * paciente relatou (observação/atividade) naquele momento, quando houver.
 */
function buildMeasuredPeakDetail(
  measurements: Array<{
    measuredAt: Date;
    systolic: number;
    diastolic: number;
    valid: boolean;
    observation?: string | null;
  }>,
): string {
  const valid = measurements.filter((m) => m.valid);
  if (valid.length === 0) return "";

  const peak = valid.reduce((max, item) =>
    item.systolic > max.systolic ? item : max,
  );
  const time = formatTime(peak.measuredAt);
  const base = `Maior valor pressórico registrado: ${peak.systolic}/${peak.diastolic} mmHg às ${time}`;
  const observation = peak.observation?.trim();
  return observation
    ? `${base}, durante relato de "${observation}".`
    : `${base}.`;
}

/**
 * A IA só pode reproduzir números que estejam nas frases pré-definidas.
 * Descartamos opiniões livres que contenham dígitos para não introduzir valores
 * inventados no laudo.
 */
function sanitizeSelection(selection: SelectionByCategory): SelectionByCategory {
  const safe: SelectionByCategory = {};
  for (const [category, topic] of Object.entries(selection) as Array<
    [keyof SelectionByCategory, SelectionByCategory[keyof SelectionByCategory]]
  >) {
    if (!topic) continue;
    const opinion =
      topic.opinion && /\d/.test(topic.opinion) ? undefined : topic.opinion;
    safe[category] = { codes: topic.codes ?? [], opinion };
  }
  return safe;
}

export async function generateReportContent(
  reportId: string,
  options: { keepStatus?: boolean } = {},
) {
  const report = await prisma.mapaReport.findUniqueOrThrow({
    where: { id: reportId },
    include: { sourceFile: true },
  });

  const phrases = await prisma.reportPhrase.findMany({
    where: { active: true },
  });

  const clinical = toClinical(report);
  const { thresholds, guidelineFooter } = await getClinicSettings();
  const engine = new MapaRuleEngine(thresholds);
  const results = engine.evaluate(clinical);
  await logReportEvent({ reportId, event: "RULES_PROCESSED" });

  const resolver = new ReportPhraseResolver(phrases);
  const resolved = resolver.resolve(results);
  const builder = new DeterministicReportBuilder(guidelineFooter);
  const draft = builder.build(resolved);

  const percentage = computeValidMeasurementsPercentage(
    report.validMeasurements ?? 0,
    report.totalMeasurements ?? 0,
  );

  let sections = draft;
  let usedAiFallback = true;

  // A IA escolhe, por tópico, as frases pré-definidas que melhor se enquadram
  // (e só opina qualitativamente se nenhuma servir). Números nunca vêm da IA:
  // saem sempre das frases já resolvidas pelo motor determinístico.
  const candidates = buildCandidates(resolved, phrases);
  const context = buildClinicalContext(report, percentage);
  const selector = new AiPhraseSelectionService();
  const hasCandidates = Object.keys(candidates).length > 0;

  if (selector.isConfigured() && hasCandidates) {
    await logReportEvent({
      reportId,
      event: "AI_GENERATION_STARTED",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      promptVersion: AI_SELECTION_PROMPT_VERSION,
    });
    try {
      const outcome = await selector.select(candidates, context);
      if (outcome.skipped) {
        await logReportEvent({ reportId, event: "FALLBACK_USED" });
      } else {
        sections = mergeSelection(
          candidates,
          sanitizeSelection(outcome.selection),
          draft,
        );
        usedAiFallback = false;
        await logReportEvent({
          reportId,
          event: "AI_GENERATION_COMPLETED",
          model: outcome.model,
          promptVersion: AI_SELECTION_PROMPT_VERSION,
        });
        const costs = estimateCost(
          outcome.model,
          outcome.inputTokens,
          outcome.outputTokens,
        );
        await prisma.aiUsage.create({
          data: {
            reportId,
            provider: "openai",
            model: outcome.model,
            inputTokens: outcome.inputTokens,
            outputTokens: outcome.outputTokens,
            totalTokens: outcome.totalTokens,
            ...costs,
          },
        });
      }
    } catch {
      await logReportEvent({ reportId, event: "FALLBACK_USED" });
    }
  } else {
    await logReportEvent({ reportId, event: "FALLBACK_USED" });
  }

  // Quando há picos e arquivo AWP, relaciona o pico ao horário do maior valor
  // medido e à atividade relatada (observação da medição) naquele momento.
  if (isFilledSection(sections.pressurePeaks) && report.sourceFile?.payloadJson) {
    try {
      const parsed = deserializeParseResult(report.sourceFile.payloadJson);
      const detail = buildMeasuredPeakDetail(parsed.measurements);
      if (detail && !sections.pressurePeaks.includes(detail)) {
        sections = {
          ...sections,
          pressurePeaks: `${sections.pressurePeaks} ${detail}`.trim(),
        };
      }
    } catch {
      // Sem detalhe do pico se o payload não puder ser lido.
    }
  }

  return prisma.mapaReport.update({
    where: { id: reportId },
    data: {
      ...sectionsToDb(sections),
      // Reprocesso (dev) mantém o status atual para não tirar o laudo da mesa
      // de aprovação; a geração normal marca como GENERATED.
      ...(options.keepStatus ? {} : { status: "GENERATED" }),
      usedAiFallback,
      validMeasurementsPercentage:
        report.totalMeasurements && report.validMeasurements != null
          ? percentage
          : null,
    },
  });
}

export async function saveEditedSections(
  reportId: string,
  sections: Partial<StructuredReportSections>,
) {
  const data = sectionsToDb(sections);
  if (Object.keys(data).length === 0) {
    return prisma.mapaReport.findUniqueOrThrow({ where: { id: reportId } });
  }
  await logReportEvent({ reportId, event: "REPORT_EDITED" });
  return prisma.mapaReport.update({
    where: { id: reportId },
    data,
  });
}

export async function approveReport(reportId: string) {
  await logReportEvent({ reportId, event: "REPORT_APPROVED" });
  return prisma.mapaReport.update({
    where: { id: reportId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });
}

export async function markPrinted(reportId: string) {
  await logReportEvent({ reportId, event: "REPORT_PRINTED" });
}
