import { prisma } from "@/lib/prisma";
import { buildClinicalContext } from "@/services/reports/clinicalContext";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { ReportPhraseResolver } from "@/domain/mapa/services/ReportPhraseResolver";
import { DeterministicReportBuilder } from "@/domain/mapa/services/DeterministicReportBuilder";
import { MapaMetricsCalculator } from "@/domain/mapa/services/MapaMetricsCalculator";
import type { MapaThresholds } from "@/domain/mapa/config/thresholds";
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
import { roundMmHg } from "@/domain/mapa/rules/averagePressure";
import {
  buildOfficialPeakNarrative,
  peakFlagPhrasesFrom,
} from "@/domain/mapa/rules/pressurePeaks";

function roundNullableMmHg(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return roundMmHg(value);
}

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
  caffeineUse: string;
  insomnia: string;
  cvMedicationStatus?: string | null;
  headache?: string | null;
  chestPain?: string | null;
  dyspnea?: string | null;
  dizziness?: string | null;
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

  const asFlag = (value?: string | null) =>
    value === "YES" || value === "NO" || value === "UNKNOWN" ? value : "UNKNOWN";

  return {
    ...report,
    pregnancyStatus: asFlag(report.pregnancyStatus),
    alcoholUse: asFlag(report.alcoholUse),
    smoking: asFlag(report.smoking),
    caffeineUse: asFlag(report.caffeineUse),
    insomnia: asFlag(report.insomnia),
    headache: asFlag(report.headache),
    chestPain: asFlag(report.chestPain),
    dyspnea: asFlag(report.dyspnea),
    dizziness: asFlag(report.dizziness),
    cvMedicationStatus: asFlag(report.cvMedicationStatus),
    specialSituations: special,
    officeSystolicPressure: roundNullableMmHg(report.officeSystolicPressure),
    officeDiastolicPressure: roundNullableMmHg(report.officeDiastolicPressure),
    avg24hSystolic: roundNullableMmHg(report.avg24hSystolic),
    avg24hDiastolic: roundNullableMmHg(report.avg24hDiastolic),
    awakeSystolic: roundNullableMmHg(report.awakeSystolic),
    awakeDiastolic: roundNullableMmHg(report.awakeDiastolic),
    sleepSystolic: roundNullableMmHg(report.sleepSystolic),
    sleepDiastolic: roundNullableMmHg(report.sleepDiastolic),
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

function applyMeasuredPeaks(
  pressurePeaks: string,
  measurements: Array<{
    measuredAt: Date;
    systolic: number;
    diastolic: number;
    valid: boolean;
    observation?: string | null;
  }>,
  sleepWindow: { start: string; end: string } | null,
): string {
  const official = buildOfficialPeakNarrative(measurements, sleepWindow);
  if (!official) return pressurePeaks;
  const flags = peakFlagPhrasesFrom(pressurePeaks);
  return [official, ...flags].join("\n");
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

function overallLoadsFromSource(
  sourceFile:
    | {
        payloadJson?: string | null;
        sleepStart?: string | null;
        sleepEnd?: string | null;
      }
    | null
    | undefined,
  thresholds: MapaThresholds,
): { overallSystolicLoad: number | null; overallDiastolicLoad: number | null } {
  if (!sourceFile?.payloadJson) {
    return { overallSystolicLoad: null, overallDiastolicLoad: null };
  }
  try {
    const parsed = deserializeParseResult(sourceFile.payloadJson);
    const sleepWindow =
      sourceFile.sleepStart && sourceFile.sleepEnd
        ? { start: sourceFile.sleepStart, end: sourceFile.sleepEnd }
        : parsed.sleepWindow
          ? { start: parsed.sleepWindow.start, end: parsed.sleepWindow.end }
          : null;
    const metrics = new MapaMetricsCalculator(thresholds).calculate(
      parsed.measurements,
      sleepWindow,
    );
    return {
      overallSystolicLoad: metrics.overall?.systolicLoad ?? null,
      overallDiastolicLoad: metrics.overall?.diastolicLoad ?? null,
    };
  } catch {
    return { overallSystolicLoad: null, overallDiastolicLoad: null };
  }
}

type ClinicalReportInput = Parameters<typeof toClinical>[0];

/** Frases numéricas (médias, cargas, descenso) a partir das regras atuais. */
export async function buildDeterministicDraft(report: ClinicalReportInput) {
  const phrases = await prisma.reportPhrase.findMany({
    where: { active: true },
  });
  const { thresholds, guidelineFooter } = await getClinicSettings();
  const resolved = new ReportPhraseResolver(phrases).resolve(
    new MapaRuleEngine(thresholds).evaluate(toClinical(report)),
  );
  return new DeterministicReportBuilder(guidelineFooter).build(resolved);
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

  const { thresholds, guidelineFooter } = await getClinicSettings();
  const results = new MapaRuleEngine(thresholds).evaluate(toClinical(report));
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
  const overallLoads = overallLoadsFromSource(report.sourceFile, thresholds);
  const context = buildClinicalContext({ ...report, ...overallLoads }, percentage);
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

  // Picos no formato do roteiro: maior PAS/PAD na vigília e no sono, com sintoma.
  if (report.sourceFile?.payloadJson) {
    try {
      const parsed = deserializeParseResult(report.sourceFile.payloadJson);
      const sleepWindow =
        report.sourceFile.sleepStart && report.sourceFile.sleepEnd
          ? {
              start: report.sourceFile.sleepStart,
              end: report.sourceFile.sleepEnd,
            }
          : parsed.sleepWindow
            ? {
                start: parsed.sleepWindow.start,
                end: parsed.sleepWindow.end,
              }
            : null;
      sections = {
        ...sections,
        pressurePeaks: applyMeasuredPeaks(
          sections.pressurePeaks,
          parsed.measurements,
          sleepWindow,
        ),
      };
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
