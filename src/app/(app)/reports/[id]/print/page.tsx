import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { MapaPrintDocument } from "@/components/mapa/MapaPrintDocument";
import { PrintToolbar } from "@/components/mapa/PrintToolbar";
import {
  buildMapaPrintStatistics,
  type MapaPrintStatistics,
} from "@/domain/mapa/services/MapaPrintStatistics";
import { prisma } from "@/lib/prisma";
import { deserializeParseResult } from "@/services/imports/awpParseResultCodec";
import { markPrinted } from "@/services/reports/generateReport";
import { getClinicSettings } from "@/services/settings/clinicSettings";

export const dynamic = "force-dynamic";

function statsFromManualReport(report: {
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
}): MapaPrintStatistics {
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

export default async function PrintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  // Nome direto do banco: a sessão (JWT) pode ficar com o nome antigo até novo login.
  const doctor = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
    : null;
  const doctorName = doctor?.name ?? session?.user?.name;
  const report = await prisma.mapaReport.findUnique({
    where: { id },
    include: { patient: true, sourceFile: true },
  });
  if (!report) notFound();
  if (report.status !== "APPROVED") {
    redirect(`/reports/${report.id}`);
  }

  after(() => {
    void markPrinted(report.id);
  });

  const { thresholds, guidelineFooter } = await getClinicSettings();

  let stats: MapaPrintStatistics;
  let awpPatient = null;
  let chartPoints: Array<{
    at: Date;
    systolic: number;
    diastolic: number;
    heartRate?: number;
  }> = [];
  let sleepWindow: { start: string; end: string } | null = null;
  let measurementNotes: Array<{
    index: number;
    at: Date;
    systolic: number;
    diastolic: number;
    heartRate?: number;
    valid: boolean;
    observation: string;
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
    const anyChart =
      report.includeTrendChart ||
      report.includeHistogramChart ||
      report.includePieChart;
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
    measurementNotes = parsed.measurements
      .filter((measurement) => Boolean(measurement.observation?.trim()))
      .map((measurement) => ({
        index: measurement.index,
        at: measurement.measuredAt,
        systolic: measurement.systolic,
        diastolic: measurement.diastolic,
        heartRate: measurement.heartRate,
        valid: measurement.valid,
        observation: measurement.observation!.trim(),
      }));
  } else {
    stats = statsFromManualReport(report);
  }

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <PrintToolbar />
      <MapaPrintDocument
        awpPatient={awpPatient}
        assistantDoctorName={report.assistantDoctorName}
        chartPoints={chartPoints}
        doctorName={doctorName}
        examDate={report.examDate}
        guidelineNote={guidelineFooter}
        includeHistogramChart={report.includeHistogramChart}
        includePieChart={report.includePieChart}
        includeTrendChart={report.includeTrendChart}
        measurementNotes={measurementNotes}
        narrative={{
          medications: report.generatedMedications,
          technicalComments: report.generatedTechnicalComments,
          averagePressure: report.generatedResults,
          pressureLoad: report.generatedPressureLoad,
          pressurePeaks: report.generatedPressurePeaks,
          nightDipping: report.generatedNightDipping,
          specialSituations: report.generatedSpecialSituations,
          generalConsiderations: report.generatedGeneralConsiderations,
          conclusion: report.generatedConclusion,
        }}
        officeDiastolic={report.officeDiastolicPressure}
        officeHeartRate={report.officeHeartRate}
        officeSystolic={report.officeSystolicPressure}
        patient={report.patient}
        sleepWindow={sleepWindow}
        stats={stats}
        thresholds={thresholds}
      />
    </div>
  );
}
