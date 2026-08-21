"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireApprover, requireUser } from "@/lib/authz";
import { readRequiredSpecialFlags } from "@/domain/mapa/specialFlags";
import { reportSectionsSchema } from "@/lib/validation";
import {
  approveReport,
  generateReportContent,
  saveEditedSections,
} from "@/services/reports/generateReport";
import { logReportEvent } from "@/services/audit/log";
import {
  notifyApprovers,
  notifyReportCreator,
} from "@/services/notifications/notifications";
import {
  PatientResolutionError,
  resolvePatientFromForm,
} from "@/services/patients/resolvePatientFromForm";

function num(formData: FormData, name: string): number | null {
  const value = formData.get(name);
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function bool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

export async function createAndGenerateReport(formData: FormData) {
  const user = await requireUser();

  let patientId: string;
  try {
    patientId = await resolvePatientFromForm(formData);
  } catch (error) {
    const message =
      error instanceof PatientResolutionError
        ? error.userMessage
        : "Não foi possível identificar o paciente.";
    redirect(`/reports/new?error=${encodeURIComponent(message)}`);
  }

  const specialSituations = formData
    .getAll("specialSituations")
    .map(String)
    .filter((value) => value !== "PREGNANT");
  const specialFlags = readRequiredSpecialFlags(formData);
  if (!specialFlags) {
    redirect(`/reports/new?error=${encodeURIComponent("Informe todas as situações especiais.")}`);
  }
  if (
    specialFlags.pregnancyStatus === "YES" &&
    num(formData, "pregnancyMonths") == null
  ) {
    redirect(
      `/reports/new?error=${encodeURIComponent("Informe os meses de gestação.")}`,
    );
  }

  const report = await prisma.mapaReport.create({
    data: {
      patientId,
      examDate: new Date(String(formData.get("examDate") ?? "")),
      source: "MANUAL",
      status: "DRAFT",
      currentMedications: String(formData.get("currentMedications") ?? ""),
      officeSystolicPressure: num(formData, "officeSystolicPressure"),
      officeDiastolicPressure: num(formData, "officeDiastolicPressure"),
      officeHeartRate: num(formData, "officeHeartRate"),
      pregnancy: specialFlags.pregnancyStatus === "YES",
      pregnancyMonths:
        specialFlags.pregnancyStatus === "YES"
          ? num(formData, "pregnancyMonths")
          : null,
      pregnancyStatus: specialFlags.pregnancyStatus,
      alcoholUse: specialFlags.alcoholUse,
      smoking: specialFlags.smoking,
      insomnia: specialFlags.insomnia,
      caffeineUse: specialFlags.caffeineUse,
      totalMeasurements: num(formData, "totalMeasurements"),
      validMeasurements: num(formData, "validMeasurements"),
      technicalComments: String(formData.get("technicalComments") ?? "") || null,
      avg24hSystolic: num(formData, "avg24hSystolic"),
      avg24hDiastolic: num(formData, "avg24hDiastolic"),
      awakeSystolic: num(formData, "awakeSystolic"),
      awakeDiastolic: num(formData, "awakeDiastolic"),
      sleepSystolic: num(formData, "sleepSystolic"),
      sleepDiastolic: num(formData, "sleepDiastolic"),
      awakeSystolicLoad: num(formData, "awakeSystolicLoad"),
      awakeDiastolicLoad: num(formData, "awakeDiastolicLoad"),
      sleepSystolicLoad: num(formData, "sleepSystolicLoad"),
      sleepDiastolicLoad: num(formData, "sleepDiastolicLoad"),
      systolicNightDipping: num(formData, "systolicNightDipping"),
      diastolicNightDipping: num(formData, "diastolicNightDipping"),
      peakAwake: bool(formData, "peakAwake"),
      peakSleep: bool(formData, "peakSleep"),
      peakMorning: bool(formData, "peakMorning"),
      peakWithHeartRateIncrease: bool(formData, "peakWithHeartRateIncrease"),
      peakPhysicalEmotionalStress: bool(formData, "peakPhysicalEmotionalStress"),
      peakPressureNotes: String(formData.get("peakPressureNotes") ?? "") || null,
      specialSituations: JSON.stringify(specialSituations),
      assistantDoctorName:
        String(formData.get("assistantDoctorName") ?? "").trim() || null,
      createdById: user.id,
    },
  });

  await logReportEvent({ reportId: report.id, event: "REPORT_CREATED" });

  await generateReportContent(report.id);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${report.id}`);
}

/** Enquanto o laudo aguarda aprovação, só o aprovador pode alterá-lo. */
async function requireEditPermission(reportId: string) {
  const user = await requireUser();
  const report = await prisma.mapaReport.findUniqueOrThrow({
    where: { id: reportId },
    select: { status: true },
  });
  if (report.status === "APPROVED") {
    redirect(`/reports/${reportId}?error=laudo-aprovado`);
  }
  if (report.status === "PENDING_APPROVAL" && user.role !== "DOCTOR") {
    redirect(`/reports/${reportId}?error=aguardando-aprovacao`);
  }
  return user;
}

export async function updateReportSections(reportId: string, formData: FormData) {
  await requireEditPermission(reportId);
  const parsed = reportSectionsSchema.parse({
    medications: String(formData.get("medications") ?? ""),
    technicalComments: String(formData.get("technicalComments") ?? ""),
    averagePressure: String(formData.get("averagePressure") ?? ""),
    pressureLoad: String(formData.get("pressureLoad") ?? ""),
    pressurePeaks: String(formData.get("pressurePeaks") ?? ""),
    nightDipping: String(formData.get("nightDipping") ?? ""),
    specialSituations: String(formData.get("specialSituations") ?? ""),
    generalConsiderations: String(formData.get("generalConsiderations") ?? ""),
    conclusion: String(formData.get("conclusion") ?? ""),
  });
  await saveEditedSections(reportId, parsed);
  await prisma.mapaReport.update({
    where: { id: reportId },
    data: {
      includeTrendChart: bool(formData, "includeTrendChart"),
      includeHistogramChart: bool(formData, "includeHistogramChart"),
      includePieChart: bool(formData, "includePieChart"),
      assistantDoctorName:
        String(formData.get("assistantDoctorName") ?? "").trim() || null,
    },
  });
  revalidatePath(`/reports/${reportId}`);
}

export async function updateIncludeChartsAction(reportId: string, formData: FormData) {
  await requireEditPermission(reportId);
  await prisma.mapaReport.update({
    where: { id: reportId },
    data: {
      includeTrendChart: bool(formData, "includeTrendChart"),
      includeHistogramChart: bool(formData, "includeHistogramChart"),
      includePieChart: bool(formData, "includePieChart"),
    },
  });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath(`/reports/${reportId}/print`);
}

/** Operador (ou aprovador) envia o laudo para aprovação e avisa os aprovadores. */
export async function submitReportAction(reportId: string) {
  const user = await requireUser();
  const report = await prisma.mapaReport.update({
    where: { id: reportId },
    data: { status: "PENDING_APPROVAL", submittedAt: new Date(), reviewNotes: null },
    include: { patient: true },
  });
  await logReportEvent({ reportId, event: "REPORT_SUBMITTED" });
  await notifyApprovers({
    reportId,
    excludeUserId: user.id,
    message: `Laudo de ${report.patient.name} aguardando aprovação.`,
  });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

/** Só o aprovador aprova. */
export async function approveReportAction(reportId: string) {
  await requireApprover();
  const report = await approveReport(reportId);
  const patient = await prisma.patient.findUnique({
    where: { id: report.patientId },
  });
  await notifyReportCreator({
    reportId,
    createdById: report.createdById,
    type: "REPORT_APPROVED",
    message: `Laudo de ${patient?.name ?? "paciente"} foi aprovado.`,
  });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

/** Aprovador devolve o laudo com pendências; quem gerou é notificado. */
export async function returnReportAction(reportId: string, formData: FormData) {
  await requireApprover();
  const notes = String(formData.get("reviewNotes") ?? "").trim();
  if (!notes) {
    redirect(`/reports/${reportId}?error=descreva-pendencias`);
  }
  const report = await prisma.mapaReport.update({
    where: { id: reportId },
    data: { status: "CHANGES_REQUESTED", reviewNotes: notes },
    include: { patient: true },
  });
  await logReportEvent({ reportId, event: "REPORT_RETURNED" });
  await notifyReportCreator({
    reportId,
    createdById: report.createdById,
    type: "REPORT_RETURNED",
    message: `Laudo de ${report.patient.name} devolvido com pendências: ${notes}`,
  });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}
