import { prisma } from "@/lib/prisma";
import { ContecAbpm50AwpParser } from "@/domain/mapa/import/awp/ContecAbpm50AwpParser";
import { NoMeasurementsFoundError } from "@/domain/mapa/import/awp/errors";
import type { MapaFileParseResult } from "@/domain/mapa/import/awp/types";
import {
  MapaMetricsCalculator,
  type MapaMetrics,
  type SleepWindowInput,
} from "@/domain/mapa/services/MapaMetricsCalculator";
import { formatDateTime, normalizeExamDate } from "@/lib/dates";
import { logReportEvent } from "@/services/audit/log";
import { reportRepository } from "@/repositories/reportRepository";
import {
  deserializeParseResult,
  serializeParseResult,
} from "./awpParseResultCodec";
import { assertAcceptableAwpUpload } from "./awpUploadGuard";
import { getClinicSettings } from "@/services/settings/clinicSettings";
import { resolvePatientFromAwpData } from "@/services/patients/resolvePatientFromForm";
import { applyMeasurementDiscard, applyMeasurementDiscards } from "@/domain/mapa/import/awp/measurementDiscard";
import type { TriStateFlag } from "@/domain/mapa/specialFlags";

const parser = new ContecAbpm50AwpParser();

export interface AnalyzeAwpInput {
  fileName: string;
  buffer: Buffer;
}

/**
 * Lê o arquivo e guarda a análise. Nenhum laudo é criado nesta etapa: o médico
 * precisa conferir o preview e confirmar a importação.
 * O paciente é cadastrado/reutilizado a partir de [PATIENTDATA].
 */
export async function analyzeAwpFile(input: AnalyzeAwpInput) {
  assertAcceptableAwpUpload({
    fileName: input.fileName,
    size: input.buffer.length,
    buffer: input.buffer,
  });

  const result = await parser.parse(input.buffer, input.fileName);
  const patientId = await resolvePatientFromAwpData(result.patientData);
  const invalid = result.measurements.filter((measurement) => !measurement.valid).length;

  // O log técnico não registra nome de paciente nem conteúdo do arquivo.
  console.info("[awp-import] arquivo analisado", {
    format: result.detectedFormat,
    version: result.detectedVersion,
    parserVersion: result.parserVersion,
    confidence: result.confidence,
    records: result.rawRecords.length,
    hash: result.file.sha256.slice(0, 12),
  });

  const sourceFile = await prisma.mapaSourceFile.create({
    data: {
      patientId,
      status: "ANALYZED",
      manufacturer: result.manufacturer,
      deviceModel: result.deviceModel,
      originalFileName: result.file.originalName,
      fileSize: result.file.size,
      fileHash: result.file.sha256,
      encoding: result.encoding,
      detectedFormat: result.detectedFormat,
      detectedVersion: result.detectedVersion ?? null,
      parserVersion: result.parserVersion,
      parseConfidence: result.confidence,
      totalRecords: result.rawRecords.length,
      validMeasurements: result.measurements.length - invalid,
      invalidMeasurements: invalid,
      metadataJson: JSON.stringify(result.metadata),
      warningsJson: JSON.stringify(result.warnings),
      payloadJson: serializeParseResult(result),
      // O arquivo original é gravado byte a byte, sem qualquer alteração.
      content: Uint8Array.from(input.buffer),
      sleepStart: result.sleepWindow?.start ?? null,
      sleepEnd: result.sleepWindow?.end ?? null,
      sleepSource: result.sleepWindow?.source ?? null,
    },
  });

  return { sourceFileId: sourceFile.id, result };
}

export interface AwpImportPreview {
  sourceFile: NonNullable<Awaited<ReturnType<typeof loadSourceFile>>>["sourceFile"];
  result: MapaFileParseResult;
  metrics: MapaMetrics;
  sleepWindow: SleepWindowInput | null;
  sleepSource: "FILE" | "MANUAL" | "DEVICE_CONFIGURATION" | null;
  canImport: boolean;
}

async function loadSourceFile(id: string) {
  const sourceFile = await prisma.mapaSourceFile.findUnique({
    where: { id },
    include: { patient: true, report: true },
  });
  if (!sourceFile) return null;
  return { sourceFile, result: deserializeParseResult(sourceFile.payloadJson) };
}

/**
 * Monta o preview. A janela de sono informada manualmente tem prioridade sobre
 * a do arquivo, mas nenhuma janela é inventada quando as duas faltam.
 */
export async function getAwpImportPreview(
  id: string,
  manualSleep?: { start?: string | null; end?: string | null },
): Promise<AwpImportPreview | null> {
  const loaded = await loadSourceFile(id);
  if (!loaded) return null;

  const { sourceFile, result } = loaded;
  const manualStart = manualSleep?.start?.trim();
  const manualEnd = manualSleep?.end?.trim();

  const sleepWindow: SleepWindowInput | null =
    manualStart && manualEnd
      ? { start: manualStart, end: manualEnd }
      : result.sleepWindow
        ? { start: result.sleepWindow.start, end: result.sleepWindow.end }
        : null;

  const sleepSource = sleepWindow
    ? manualStart && manualEnd
      ? "MANUAL"
      : (result.sleepWindow?.source ?? null)
    : null;

  const { thresholds } = await getClinicSettings();
  const metrics = new MapaMetricsCalculator(thresholds).calculate(result.measurements, sleepWindow);

  return {
    sourceFile,
    result,
    metrics,
    sleepWindow: metrics.sleepWindow,
    sleepSource,
    canImport: result.confidence !== "UNKNOWN" && metrics.validMeasurements > 0,
  };
}

export interface ConfirmAwpImportInput {
  sourceFileId: string;
  patientId: string;
  examDate: Date;
  sleepStart?: string | null;
  sleepEnd?: string | null;
  currentMedications: string;
  cvMedicationStatus: TriStateFlag;
  officeSystolicPressure: number | null;
  officeDiastolicPressure: number | null;
  officeHeartRate: number | null;
  pregnancyStatus: TriStateFlag;
  alcoholUse: TriStateFlag;
  smoking: TriStateFlag;
  caffeineUse: TriStateFlag;
  insomnia: TriStateFlag;
  headache: TriStateFlag;
  chestPain: TriStateFlag;
  dyspnea: TriStateFlag;
  dizziness: TriStateFlag;
  pregnancyMonths: number | null;
  specialSituations?: string[];
  /** Observações clínicas por índice de medição. */
  observations?: Record<number, string>;
  /** Medições desconsideradas pelo revisor na conferência. */
  discardedIndexes?: number[];
  includeTrendChart?: boolean;
  includeHistogramChart?: boolean;
  includePieChart?: boolean;
  assistantDoctorName?: string | null;
  createdById?: string | null;
}

function reportFieldsFromMetrics(metrics: MapaMetrics) {
  return {
    totalMeasurements: metrics.totalMeasurements,
    validMeasurements: metrics.validMeasurements,
    validMeasurementsPercentage: metrics.validMeasurementsPercentage,
    avg24hSystolic: metrics.avg24hSystolic,
    avg24hDiastolic: metrics.avg24hDiastolic,
    awakeSystolic: metrics.awake?.avgSystolic ?? null,
    awakeDiastolic: metrics.awake?.avgDiastolic ?? null,
    sleepSystolic: metrics.sleep?.avgSystolic ?? null,
    sleepDiastolic: metrics.sleep?.avgDiastolic ?? null,
    awakeSystolicLoad: metrics.awake?.systolicLoad ?? null,
    awakeDiastolicLoad: metrics.awake?.diastolicLoad ?? null,
    sleepSystolicLoad: metrics.sleep?.systolicLoad ?? null,
    sleepDiastolicLoad: metrics.sleep?.diastolicLoad ?? null,
    systolicNightDipping: metrics.systolicNightDipping,
    diastolicNightDipping: metrics.diastolicNightDipping,
    peakPressureNotes: buildPeakNotes(metrics),
  };
}
function buildPeakNotes(metrics: MapaMetrics): string | null {
  const parts: string[] = [];
  if (metrics.peakSystolic) {
    parts.push(
      `Maior PAS registrada: ${metrics.peakSystolic.value} mmHg em ${formatDateTime(metrics.peakSystolic.at)}.`,
    );
  }
  if (metrics.peakDiastolic) {
    parts.push(
      `Maior PAD registrada: ${metrics.peakDiastolic.value} mmHg em ${formatDateTime(metrics.peakDiastolic.at)}.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Grava as métricas no laudo do paciente naquela data de exame.
 * Se o laudo já existir, atualiza o mesmo registro (e o status) em vez de duplicar.
 * O texto do laudo continua sendo produzido por `generateReportContent`.
 */
export async function confirmAwpImport(input: ConfirmAwpImportInput) {
  const loaded = await loadSourceFile(input.sourceFileId);
  if (!loaded) throw new NoMeasurementsFoundError();

  const { sourceFile, result } = loaded;
  if (result.confidence === "UNKNOWN") {
    throw new NoMeasurementsFoundError(
      "A estrutura deste arquivo não foi reconhecida com segurança. A importação foi bloqueada.",
    );
  }

  const sleepWindow: SleepWindowInput | null =
    input.sleepStart && input.sleepEnd
      ? { start: input.sleepStart, end: input.sleepEnd }
      : result.sleepWindow
        ? { start: result.sleepWindow.start, end: result.sleepWindow.end }
        : null;

  const observations = input.observations ?? {};
  const measurementsWithNotes = result.measurements.map((measurement) => {
    const observation = observations[measurement.index];
    return observation ? { ...measurement, observation } : measurement;
  });
  const measurementsForReport = applyMeasurementDiscards(
    measurementsWithNotes,
    input.discardedIndexes ?? [],
  );
  const resultWithNotes = { ...result, measurements: measurementsForReport };

  const { thresholds } = await getClinicSettings();
  const metrics = new MapaMetricsCalculator(thresholds).calculate(
    resultWithNotes.measurements,
    sleepWindow,
  );
  if (metrics.validMeasurements === 0) throw new NoMeasurementsFoundError();

  const examDate = normalizeExamDate(input.examDate);
  const existing = await reportRepository.findByPatientAndExamDay(
    input.patientId,
    examDate,
  );
  if (existing?.active && existing.status === "APPROVED") {
    return {
      reportId: existing.id,
      metrics,
      keepStatus: true,
      locked: true,
    };
  }

  const clinical = {
    patientId: input.patientId,
    examDate,
    source: "FILE" as const,
    currentMedications: input.currentMedications,
    cvMedicationStatus: input.cvMedicationStatus,
    officeSystolicPressure: input.officeSystolicPressure,
    officeDiastolicPressure: input.officeDiastolicPressure,
    officeHeartRate: input.officeHeartRate,
    pregnancy: input.pregnancyStatus === "YES",
    pregnancyMonths:
      input.pregnancyStatus === "YES" ? input.pregnancyMonths : null,
    pregnancyStatus: input.pregnancyStatus,
    alcoholUse: input.alcoholUse,
    smoking: input.smoking,
    caffeineUse: input.caffeineUse,
    insomnia: input.insomnia,
    headache: input.headache,
    chestPain: input.chestPain,
    dyspnea: input.dyspnea,
    dizziness: input.dizziness,
    ...reportFieldsFromMetrics(metrics),
    specialSituations: JSON.stringify(input.specialSituations ?? []),
    includeTrendChart: input.includeTrendChart ?? true,
    includeHistogramChart: input.includeHistogramChart ?? true,
    includePieChart: input.includePieChart ?? true,
    assistantDoctorName: input.assistantDoctorName?.trim() || null,
    createdById: input.createdById ?? null,
  };

  const keepReview =
    existing?.status === "CHANGES_REQUESTED" ||
    existing?.status === "PENDING_APPROVAL";
  const { report, existing: savedExisting } =
    await reportRepository.saveForPatientExamDay({
      patientId: input.patientId,
      examDate,
      create: {
        ...clinical,
        status: "DRAFT",
      },
      update: {
        ...clinical,
        ...(keepReview
          ? {}
          : {
              status: "DRAFT",
              approvedAt: null,
              submittedAt: null,
              reviewNotes: null,
              reviewNotesByTopic: "{}",
            }),
      },
    });
  const reused = savedExisting ?? existing;

  if (reused) {
    await prisma.mapaSourceFile.updateMany({
      where: { reportId: report.id, id: { not: sourceFile.id } },
      data: { reportId: null },
    });
  }

  await prisma.mapaSourceFile.update({
    where: { id: sourceFile.id },
    data: {
      reportId: report.id,
      patientId: input.patientId,
      status: "IMPORTED",
      importedAt: new Date(),
      sleepStart: sleepWindow?.start ?? null,
      sleepEnd: sleepWindow?.end ?? null,
      sleepSource: sleepWindow
        ? input.sleepStart && input.sleepEnd
          ? "MANUAL"
          : (result.sleepWindow?.source ?? null)
        : null,
      payloadJson: serializeParseResult(resultWithNotes),
    },
  });

  if (!reused) {
    await logReportEvent({ reportId: report.id, event: "REPORT_CREATED" });
  }
  await logReportEvent({ reportId: report.id, event: "FILE_IMPORTED" });

  return {
    reportId: report.id,
    metrics,
    keepStatus: keepReview,
    locked: false,
  };
}

export async function discardAwpImport(sourceFileId: string) {
  await prisma.mapaSourceFile.update({
    where: { id: sourceFileId },
    data: { status: "DISCARDED" },
  });
}

/**
 * Desconsidera ou restaura uma medição de um laudo já importado e atualiza
 * as métricas. O texto do laudo deve ser regenerado em seguida.
 */
export async function setImportedMeasurementDiscarded(input: {
  reportId: string;
  measurementIndex: number;
  discarded: boolean;
}) {
  const report = await prisma.mapaReport.findUnique({
    where: { id: input.reportId },
    include: { sourceFile: true },
  });
  if (!report?.sourceFile?.payloadJson) {
    throw new NoMeasurementsFoundError(
      "Este laudo não tem arquivo de medições para editar.",
    );
  }

  const result = deserializeParseResult(report.sourceFile.payloadJson);
  const measurements = result.measurements.map((measurement) =>
    measurement.index === input.measurementIndex
      ? applyMeasurementDiscard(measurement, input.discarded)
      : measurement,
  );

  const sleepWindow: SleepWindowInput | null =
    report.sourceFile.sleepStart && report.sourceFile.sleepEnd
      ? {
          start: report.sourceFile.sleepStart,
          end: report.sourceFile.sleepEnd,
        }
      : result.sleepWindow
        ? { start: result.sleepWindow.start, end: result.sleepWindow.end }
        : null;

  const { thresholds } = await getClinicSettings();
  const metrics = new MapaMetricsCalculator(thresholds).calculate(
    measurements,
    sleepWindow,
  );
  if (metrics.validMeasurements === 0) throw new NoMeasurementsFoundError();

  await prisma.mapaSourceFile.update({
    where: { id: report.sourceFile.id },
    data: {
      payloadJson: serializeParseResult({ ...result, measurements }),
    },
  });
  await prisma.mapaReport.update({
    where: { id: report.id },
    data: reportFieldsFromMetrics(metrics),
  });
}
