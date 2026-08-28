import {
  buildMapaPrintStatistics,
  type MapaPrintStatistics,
} from "@/domain/mapa/services/MapaPrintStatistics";
import { prisma } from "@/lib/prisma";
import { deserializeParseResult } from "@/services/imports/awpParseResultCodec";
import { getClinicSettings } from "@/services/settings/clinicSettings";
import { buildDeterministicDraft } from "@/services/reports/generateReport";

type ManualStatsInput = {
  examDate: Date;
  totalMeasurements: number | null;
  validMeasurements: number | null;
  validMeasurementsPercentage: number | null;
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
};

/** Estatísticas mínimas a partir dos campos manuais do laudo (sem arquivo AWP). */
function statsFromManualReport(report: ManualStatsInput): MapaPrintStatistics {
  const emptySeries = {
    max: null,
    min: null,
    mean: null,
    sd: null,
    se: null,
    cv: null,
  };

  return {
    totalAttempts: report.totalMeasurements ?? 0,
    validCount: report.validMeasurements ?? 0,
    validPercentage: report.validMeasurementsPercentage,
    examStart: report.examDate,
    examEnd: null,
    durationLabel: null,
    overall: {
      label: "Geral",
      count: report.validMeasurements ?? 0,
      systolic: { ...emptySeries, mean: report.avg24hSystolic },
      diastolic: { ...emptySeries, mean: report.avg24hDiastolic },
      heartRate: emptySeries,
      meanArterialPressure: emptySeries,
      pulsePressure: emptySeries,
      systolicLoadPercent: null,
      diastolicLoadPercent: null,
      systolicThreshold: 130,
      diastolicThreshold: 80,
    },
    awake:
      report.awakeSystolic != null
        ? {
            label: "Vigília",
            count: 0,
            systolic: { ...emptySeries, mean: report.awakeSystolic },
            diastolic: { ...emptySeries, mean: report.awakeDiastolic },
            heartRate: emptySeries,
            meanArterialPressure: emptySeries,
            pulsePressure: emptySeries,
            systolicLoadPercent: report.awakeSystolicLoad,
            diastolicLoadPercent: report.awakeDiastolicLoad,
            systolicThreshold: 135,
            diastolicThreshold: 85,
          }
        : null,
    sleep:
      report.sleepSystolic != null
        ? {
            label: "Sono",
            count: 0,
            systolic: { ...emptySeries, mean: report.sleepSystolic },
            diastolic: { ...emptySeries, mean: report.sleepDiastolic },
            heartRate: emptySeries,
            meanArterialPressure: emptySeries,
            pulsePressure: emptySeries,
            systolicLoadPercent: report.sleepSystolicLoad,
            diastolicLoadPercent: report.sleepDiastolicLoad,
            systolicThreshold: 120,
            diastolicThreshold: 70,
          }
        : null,
    avg24hSystolic: report.avg24hSystolic,
    avg24hDiastolic: report.avg24hDiastolic,
    awakeAvgSystolic: report.awakeSystolic,
    awakeAvgDiastolic: report.awakeDiastolic,
    sleepAvgSystolic: report.sleepSystolic,
    sleepAvgDiastolic: report.sleepDiastolic,
    awakeSystolicLoad: report.awakeSystolicLoad,
    awakeDiastolicLoad: report.awakeDiastolicLoad,
    sleepSystolicLoad: report.sleepSystolicLoad,
    sleepDiastolicLoad: report.sleepDiastolicLoad,
    systolicNightDipping: report.systolicNightDipping,
    diastolicNightDipping: report.diastolicNightDipping,
    peakSystolic: null,
    peakDiastolic: null,
    troughSystolic: null,
    troughDiastolic: null,
    avgHeartRateAwake: null,
    avgHeartRateSleep: null,
    avgPulsePressureAwake: null,
    avgPulsePressureSleep: null,
    cvOverallSystolic: null,
    cvOverallDiastolic: null,
    cvAwakeSystolic: null,
    cvAwakeDiastolic: null,
    cvSleepSystolic: null,
    cvSleepDiastolic: null,
  };
}

export type ReportPrintModel = Awaited<
  ReturnType<typeof buildReportPrintModel>
>;

/**
 * Monta todos os dados necessários para renderizar o layout de impressão do
 * laudo, reusado tanto pela página de impressão quanto pelo pré-laudo do
 * aprovador. `showAllCharts` força todos os gráficos (visão do aprovador).
 */
export async function buildReportPrintModel(
  reportId: string,
  { showAllCharts }: { showAllCharts: boolean },
) {
  const report = await prisma.mapaReport.findUnique({
    where: { id: reportId },
    include: { patient: true, sourceFile: true },
  });
  if (!report) return null;

  const { thresholds, guidelineFooter } = await getClinicSettings();

  const includeTrendChart = showAllCharts ? true : report.includeTrendChart;
  const includeHistogramChart = showAllCharts
    ? true
    : report.includeHistogramChart;
  const includePieChart = showAllCharts ? true : report.includePieChart;
  const anyChart = includeTrendChart || includeHistogramChart || includePieChart;

  let stats: MapaPrintStatistics;
  let awpPatient = null;
  let chartPoints: Array<{
    at: Date;
    systolic: number;
    diastolic: number;
    heartRate?: number;
  }> = [];
  let sleepWindow: { start: string; end: string } | null = null;
  let measurements: Array<{
    index: number;
    at: Date;
    systolic: number;
    diastolic: number;
    meanArterialPressure?: number | null;
    heartRate?: number | null;
    valid: boolean;
    observation?: string | null;
  }> = [];

  if (report.sourceFile?.payloadJson) {
    const parsed = deserializeParseResult(report.sourceFile.payloadJson);
    awpPatient = parsed.patientData ?? null;
    sleepWindow =
      report.sourceFile.sleepStart && report.sourceFile.sleepEnd
        ? {
            start: report.sourceFile.sleepStart,
            end: report.sourceFile.sleepEnd,
          }
        : parsed.sleepWindow
          ? { start: parsed.sleepWindow.start, end: parsed.sleepWindow.end }
          : null;
    stats = buildMapaPrintStatistics(parsed.measurements, thresholds, sleepWindow);
    chartPoints = anyChart
      ? parsed.measurements
          .filter((measurement) => measurement.valid)
          .map((measurement) => ({
            at: measurement.measuredAt,
            systolic: measurement.systolic,
            diastolic: measurement.diastolic,
            heartRate: measurement.heartRate,
          }))
      : [];
    measurements = parsed.measurements.map((measurement) => ({
      index: measurement.index,
      at: measurement.measuredAt,
      systolic: measurement.systolic,
      diastolic: measurement.diastolic,
      meanArterialPressure: measurement.meanArterialPressure,
      heartRate: measurement.heartRate,
      valid: measurement.valid,
      discarded: Boolean(measurement.discarded),
      observation: measurement.observation?.trim() || null,
    }));
  } else {
    stats = statsFromManualReport(report);
  }

  const draft = await buildDeterministicDraft(report);

  return {
    report,
    guidelineNote: guidelineFooter,
    thresholds,
    stats,
    awpPatient,
    chartPoints,
    sleepWindow,
    measurements,
    includeTrendChart,
    includeHistogramChart,
    includePieChart,
    narrative: {
      medications: report.generatedMedications,
      technicalComments: report.generatedTechnicalComments,
      averagePressure: draft.averagePressure,
      pressureLoad: draft.pressureLoad,
      pressurePeaks: report.generatedPressurePeaks,
      nightDipping: draft.nightDipping,
      specialSituations: report.generatedSpecialSituations,
      generalConsiderations: report.generatedGeneralConsiderations,
      conclusion: report.generatedConclusion,
    },
  };
}
