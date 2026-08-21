import { prisma } from "@/lib/prisma";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import { ReportPhraseResolver } from "@/domain/mapa/services/ReportPhraseResolver";
import { DeterministicReportBuilder } from "@/domain/mapa/services/DeterministicReportBuilder";
import { computeValidMeasurementsPercentage } from "@/domain/mapa/rules/technicalQuality";
import type { MapaClinicalData, SpecialSituationCode } from "@/domain/mapa/types/clinical";
import type { StructuredReportSections } from "@/domain/mapa/types/report";
import { AiReportService, AI_PROMPT_VERSION, pickRewritableSections } from "@/services/ai/AiReportService";
import { AiReportValidator } from "@/services/ai/AiReportValidator";
import { estimateCost } from "@/services/ai/pricing";
import { logReportEvent } from "@/services/audit/log";
import { getClinicSettings } from "@/services/settings/clinicSettings";

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

function sectionsToDb(sections: StructuredReportSections) {
  return {
    generatedMedications: sections.medications,
    generatedTechnicalComments: sections.technicalComments,
    generatedResults: sections.averagePressure,
    generatedPressureLoad: sections.pressureLoad,
    generatedPressurePeaks: sections.pressurePeaks,
    generatedNightDipping: sections.nightDipping,
    generatedSpecialSituations: sections.specialSituations,
    generatedGeneralConsiderations: sections.generalConsiderations,
    generatedConclusion: sections.conclusion,
  };
}

export async function generateReportContent(reportId: string) {
  const report = await prisma.mapaReport.findUniqueOrThrow({
    where: { id: reportId },
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

  const ai = new AiReportService();
  const hasRewritable = Object.keys(pickRewritableSections(draft)).length > 0;

  if (ai.isConfigured() && hasRewritable) {
    await logReportEvent({
      reportId,
      event: "AI_GENERATION_STARTED",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      promptVersion: AI_PROMPT_VERSION,
    });
    try {
      const rewritten = await ai.rewrite(draft);
      const validator = new AiReportValidator();
      const check = validator.validate(
        draft,
        rewritten.sections,
        report.currentMedications || draft.medications,
      );
      if (!check.ok) {
        await logReportEvent({
          reportId,
          event: "AI_GENERATION_REJECTED",
          model: rewritten.model,
          promptVersion: AI_PROMPT_VERSION,
        });
        await logReportEvent({ reportId, event: "FALLBACK_USED" });
      } else {
        sections = rewritten.sections;
        usedAiFallback = false;
        await logReportEvent({
          reportId,
          event: "AI_GENERATION_COMPLETED",
          model: rewritten.model,
          promptVersion: AI_PROMPT_VERSION,
        });
        const costs = estimateCost(
          rewritten.model,
          rewritten.inputTokens,
          rewritten.outputTokens,
        );
        await prisma.aiUsage.create({
          data: {
            reportId,
            provider: "openai",
            model: rewritten.model,
            inputTokens: rewritten.inputTokens,
            outputTokens: rewritten.outputTokens,
            totalTokens: rewritten.totalTokens,
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

  return prisma.mapaReport.update({
    where: { id: reportId },
    data: {
      ...sectionsToDb(sections),
      status: "GENERATED",
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
  sections: StructuredReportSections,
) {
  await logReportEvent({ reportId, event: "REPORT_EDITED" });
  return prisma.mapaReport.update({
    where: { id: reportId },
    data: sectionsToDb(sections),
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
