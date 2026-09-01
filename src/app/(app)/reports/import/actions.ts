"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { toUserMessage } from "@/domain/mapa/import/awp/errors";
import { applyMeasurementDiscard } from "@/domain/mapa/import/awp/measurementDiscard";
import { readRequiredSpecialFlags } from "@/domain/mapa/specialFlags";
import { generateReportContent } from "@/services/reports/generateReport";
import {
  analyzeAwpFile,
  confirmAwpImport,
  discardAwpImport,
} from "@/services/imports/awpImport";
import {
  deserializeParseResult,
  serializeParseResult,
} from "@/services/imports/awpParseResultCodec";
import { PatientResolutionError } from "@/services/patients/resolvePatientFromForm";
import { prisma } from "@/lib/prisma";
import { normalizeExamDate } from "@/lib/dates";
import { isPrismaUniqueConflict } from "@/lib/prismaErrors";
import { reportRepository } from "@/repositories/reportRepository";

function num(formData: FormData, name: string): number | null {
  const value = formData.get(name);
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function bool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

function clock(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{1,2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

/** Lê observation_<índice> do formulário de conferência. */
function readObservations(formData: FormData): Record<number, string> {
  const observations: Record<number, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^observation_(\d+)$/.exec(key);
    if (!match || typeof value !== "string") continue;
    const text = value.trim();
    if (!text) continue;
    observations[Number(match[1])] = text.slice(0, 240);
  }
  return observations;
}

/** Índices marcados para desconsiderar na conferência. */
function readDiscardedIndexes(formData: FormData): number[] {
  const indexes: number[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^discarded_(\d+)$/.exec(key);
    if (!match || value !== "1") continue;
    indexes.push(Number(match[1]));
  }
  return indexes;
}

export type AwpAnalyzeState = { error?: string };

/** Etapa 1: analisar o arquivo. Nenhum laudo é criado aqui. */
export async function analyzeAwpFileAction(
  _state: AwpAnalyzeState,
  formData: FormData,
): Promise<AwpAnalyzeState> {
  await requireUser();

  const file = formData.get("awpFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione o arquivo .AWP do equipamento." };
  }

  let sourceFileId: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeAwpFile({
      fileName: file.name,
      buffer,
    });
    sourceFileId = analysis.sourceFileId;
  } catch (error) {
    if (error instanceof PatientResolutionError) {
      return { error: error.userMessage };
    }
    return { error: toUserMessage(error) };
  }

  redirect(`/reports/import/${sourceFileId}`);
}

/** Etapa 2: com a conferência feita, importar os dados e gerar o laudo. */
export async function confirmAwpImportAction(sourceFileId: string, formData: FormData) {
  const user = await requireUser();

  const sourceFile = await prisma.mapaSourceFile.findUnique({
    where: { id: sourceFileId },
    select: { patientId: true, report: { select: { id: true, status: true } } },
  });
  const patientId = sourceFile?.patientId;
  if (!patientId) {
    redirect(`/reports/import/${sourceFileId}?error=paciente-ausente`);
  }
  if (sourceFile?.report?.status === "APPROVED") {
    redirect(`/reports/${sourceFile.report.id}`);
  }

  const examDateValue = String(formData.get("examDate") ?? "");
  if (!examDateValue) {
    redirect(`/reports/import/${sourceFileId}?error=dados-incompletos`);
  }

  const specialFlags = readRequiredSpecialFlags(formData);
  if (!specialFlags) {
    redirect(`/reports/import/${sourceFileId}?error=situacoes-especiais`);
  }
  if (specialFlags.pregnancyStatus === "YES" && num(formData, "pregnancyMonths") == null) {
    redirect(`/reports/import/${sourceFileId}?error=gestacao-meses`);
  }

  let imported;
  try {
    imported = await confirmAwpImport({
      sourceFileId,
      patientId,
      examDate: new Date(examDateValue),
      sleepStart: clock(formData, "sleepStart"),
      sleepEnd: clock(formData, "sleepEnd"),
      currentMedications: String(formData.get("currentMedications") ?? ""),
      cvMedicationStatus: specialFlags.cvMedicationStatus,
      officeSystolicPressure: num(formData, "officeSystolicPressure"),
      officeDiastolicPressure: num(formData, "officeDiastolicPressure"),
      officeHeartRate: num(formData, "officeHeartRate"),
      pregnancyStatus: specialFlags.pregnancyStatus,
      alcoholUse: specialFlags.alcoholUse,
      smoking: specialFlags.smoking,
      insomnia: specialFlags.insomnia,
      caffeineUse: specialFlags.caffeineUse,
      headache: specialFlags.headache,
      chestPain: specialFlags.chestPain,
      dyspnea: specialFlags.dyspnea,
      dizziness: specialFlags.dizziness,
      pregnancyMonths: num(formData, "pregnancyMonths"),
      specialSituations: formData
        .getAll("specialSituations")
        .map(String)
        .filter((value) => value !== "PREGNANT"),
      observations: readObservations(formData),
      discardedIndexes: readDiscardedIndexes(formData),
      includeTrendChart: bool(formData, "includeTrendChart"),
      includeHistogramChart: bool(formData, "includeHistogramChart"),
      includePieChart: bool(formData, "includePieChart"),
      assistantDoctorName:
        String(formData.get("assistantDoctorName") ?? "").trim() || null,
      createdById: user.id,
    });
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      const existing = await reportRepository.findByPatientAndExamDay(
        patientId,
        normalizeExamDate(new Date(examDateValue)),
      );
      if (existing) redirect(`/reports/${existing.id}`);
      redirect(`/reports/import/${sourceFileId}?error=laudo-existente`);
    }
    throw error;
  }

  const { reportId, keepStatus, locked } = imported;

  if (locked) {
    redirect(`/reports/${reportId}`);
  }

  await generateReportContent(reportId, { keepStatus });

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${reportId}`);
}

export async function discardAwpImportAction(sourceFileId: string) {
  await requireUser();
  await discardAwpImport(sourceFileId);
  redirect("/reports/new");
}

/** Desconsidera ou restaura uma medição na análise, antes de gerar o laudo. */
export async function setMeasurementDiscardedAction(
  sourceFileId: string,
  measurementIndex: number,
  discarded: boolean,
) {
  await requireUser();
  const sourceFile = await prisma.mapaSourceFile.findUnique({
    where: { id: sourceFileId },
    select: {
      payloadJson: true,
      report: { select: { status: true } },
    },
  });
  if (!sourceFile) return;
  if (sourceFile.report?.status === "APPROVED") {
    return;
  }

  const result = deserializeParseResult(sourceFile.payloadJson);
  const measurements = result.measurements.map((measurement) =>
    measurement.index === measurementIndex
      ? applyMeasurementDiscard(measurement, discarded)
      : measurement,
  );
  await prisma.mapaSourceFile.update({
    where: { id: sourceFileId },
    data: { payloadJson: serializeParseResult({ ...result, measurements }) },
  });
  revalidatePath(`/reports/import/${sourceFileId}`);
}
