"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireApprover, requireUser } from "@/lib/authz";
import { readRequiredSpecialFlags } from "@/domain/mapa/specialFlags";
import { REPORT_TOPICS, TOPIC_FEEDBACK_PREFIX } from "@/domain/mapa/reportTopics";
import { reportSectionsSchema } from "@/lib/validation";
import {
  approveReport,
  generateReportContent,
  saveEditedSections,
} from "@/services/reports/generateReport";
import { setImportedMeasurementDiscarded } from "@/services/imports/awpImport";
import { logReportEvent } from "@/services/audit/log";
import {
  notifyApprovers,
  notifyReportCreator,
} from "@/services/notifications/notifications";
import {
  PatientResolutionError,
  resolvePatientFromForm,
} from "@/services/patients/resolvePatientFromForm";
import { CertificateError } from "@/services/certificates/pkcs12";
import { signReportWithDoctorCertificate } from "@/services/certificates/signReport";
import { reportRepository } from "@/repositories/reportRepository";
import { normalizeExamDate } from "@/lib/dates";

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

  const examDate = normalizeExamDate(
    new Date(String(formData.get("examDate") ?? "")),
  );
  const existing = await reportRepository.findByPatientAndExamDay(
    patientId,
    examDate,
  );

  const clinical = {
    patientId,
    examDate,
    source: "MANUAL" as const,
    currentMedications: String(formData.get("currentMedications") ?? ""),
    cvMedicationStatus: specialFlags.cvMedicationStatus,
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
    caffeineUse: specialFlags.caffeineUse,
    insomnia: specialFlags.insomnia,
    headache: specialFlags.headache,
    chestPain: specialFlags.chestPain,
    dyspnea: specialFlags.dyspnea,
    dizziness: specialFlags.dizziness,
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
  };

  if (existing?.active && existing.status === "APPROVED") {
    redirect(
      `/reports/${existing.id}?error=${encodeURIComponent(
        "Já existe um laudo aprovado deste paciente nesta data de exame.",
      )}`,
    );
  }

  const saved = await reportRepository.saveForPatientExamDay({
    patientId,
    examDate,
    create: {
      ...clinical,
      status: "DRAFT",
    },
    update: {
      ...clinical,
      status: "DRAFT",
      approvedAt: null,
      submittedAt: null,
      reviewNotes: null,
      reviewNotesByTopic: "{}",
    },
  });
  if (!saved.existing) {
    await logReportEvent({ reportId: saved.report.id, event: "REPORT_CREATED" });
  }

  await generateReportContent(saved.report.id);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${saved.report.id}`);
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

function sectionsFromFormData(formData: FormData) {
  const payload: Record<string, string> = {};
  for (const topic of REPORT_TOPICS) {
    const value = formData.get(topic.key);
    if (typeof value !== "string") continue;
    payload[topic.key] = value;
  }
  return reportSectionsSchema.partial().parse(payload);
}

export async function updateReportSections(reportId: string, formData: FormData) {
  await requireEditPermission(reportId);
  const parsed = sectionsFromFormData(formData);
  if (Object.keys(parsed).length > 0) {
    await saveEditedSections(reportId, parsed);
  }
  if (formData.has("assistantDoctorName")) {
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
  }
  revalidatePath(`/reports/${reportId}`);
  revalidatePath(`/reports/${reportId}/print`);
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
    data: {
      status: "PENDING_APPROVAL",
      submittedAt: new Date(),
      reviewNotes: null,
      reviewNotesByTopic: "{}",
    },
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

function signErrorRedirect(
  reportId: string,
  message: string,
  returnTo?: string,
): never {
  const path =
    returnTo === "print" ? `/reports/${reportId}/print` : `/reports/${reportId}`;
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function signIfCertificateRegistered(
  reportId: string,
  userId: string,
  password: string,
  options?: { required?: boolean; returnTo?: string },
) {
  const doctor = await prisma.user.findUnique({
    where: { id: userId },
    select: { certificatePfx: true },
  });
  const hasCertificate = Boolean(
    doctor?.certificatePfx && doctor.certificatePfx.length > 0,
  );
  if (!hasCertificate) {
    if (options?.required) {
      signErrorRedirect(
        reportId,
        "Cadastre o certificado digital A1 em Configurações antes de assinar.",
        options.returnTo,
      );
    }
    return;
  }
  if (!password) {
    signErrorRedirect(reportId, "informe-senha-certificado", options?.returnTo);
  }
  try {
    await signReportWithDoctorCertificate({
      reportId,
      userId,
      password,
    });
  } catch (error) {
    const message =
      error instanceof CertificateError
        ? error.message
        : "Não foi possível assinar o laudo com o certificado.";
    signErrorRedirect(reportId, message, options?.returnTo);
  }
}

/** Só o aprovador aprova. A assinatura digital é opcional e feita depois. */
export async function approveReportAction(reportId: string, formData?: FormData) {
  await requireApprover();
  if (formData) {
    const parsed = sectionsFromFormData(formData);
    if (Object.keys(parsed).length > 0) {
      await saveEditedSections(reportId, parsed);
    }
  }

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
  revalidatePath(`/reports/${reportId}/print`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

/** Assina um laudo já aprovado com o certificado A1 do médico. */
export async function signApprovedReportAction(
  reportId: string,
  formData: FormData,
) {
  const user = await requireApprover();
  const report = await prisma.mapaReport.findUnique({
    where: { id: reportId },
    select: { status: true },
  });
  if (!report || report.status !== "APPROVED") {
    redirect(`/reports/${reportId}?error=${encodeURIComponent("Só é possível assinar um laudo já aprovado.")}`);
  }

  const returnTo =
    String(formData.get("returnTo") ?? "") === "print" ? "print" : undefined;
  await signIfCertificateRegistered(
    reportId,
    user.id,
    String(formData.get("certificatePassword") ?? ""),
    { required: true, returnTo },
  );

  revalidatePath(`/reports/${reportId}`);
  revalidatePath(`/reports/${reportId}/print`);
  if (returnTo === "print") {
    redirect(`/reports/${reportId}/print`);
  }
}

/** Refaz a seleção de frases pela IA, mantendo o status atual do laudo. */
export async function regenerateReportAction(reportId: string) {
  await requireEditPermission(reportId);
  await generateReportContent(reportId, { keepStatus: true });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath(`/reports/${reportId}/print`);
}

/** Aprovador (ou operador no rascunho) desconsidera uma medição e regenera o laudo. */
export async function setReportMeasurementDiscardedAction(
  reportId: string,
  measurementIndex: number,
  discarded: boolean,
) {
  await requireEditPermission(reportId);
  await setImportedMeasurementDiscarded({
    reportId,
    measurementIndex,
    discarded,
  });
  await generateReportContent(reportId, { keepStatus: true });
  await logReportEvent({
    reportId,
    event: discarded ? "MEASUREMENT_DISCARDED" : "MEASUREMENT_RESTORED",
  });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath(`/reports/${reportId}/print`);
}

/**
 * Aprovador reprova o pré-laudo com feedback por tópico; quem gerou é notificado.
 * O feedback de cada tópico chega no formulário como `feedback_<key>`.
 */
export async function returnReportAction(reportId: string, formData: FormData) {
  await requireApprover();

  const byTopic: Partial<Record<string, string>> = {};
  const summaryLines: string[] = [];
  for (const topic of REPORT_TOPICS) {
    const note = String(
      formData.get(`${TOPIC_FEEDBACK_PREFIX}${topic.key}`) ?? "",
    ).trim();
    if (note) {
      byTopic[topic.key] = note;
      summaryLines.push(`${topic.label}: ${note}`);
    }
  }

  // Feedback geral opcional, além dos tópicos.
  const generalNotes = String(formData.get("reviewNotes") ?? "").trim();
  if (generalNotes) summaryLines.push(generalNotes);

  if (summaryLines.length === 0) {
    redirect(`/reports/${reportId}?error=descreva-pendencias`);
  }

  const summary = summaryLines.join("\n");
  const report = await prisma.mapaReport.update({
    where: { id: reportId },
    data: {
      status: "CHANGES_REQUESTED",
      reviewNotes: summary,
      reviewNotesByTopic: JSON.stringify(byTopic),
    },
    include: { patient: true },
  });
  await logReportEvent({ reportId, event: "REPORT_RETURNED" });
  await notifyReportCreator({
    reportId,
    createdById: report.createdById,
    type: "REPORT_RETURNED",
    message: `Laudo de ${report.patient.name} reprovado com pendências.`,
  });
  revalidatePath(`/reports/${reportId}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

/** Só o aprovador pode inativar (soft-delete) um laudo. */
export async function deleteReportAction(reportId: string) {
  await requireApprover();
  await prisma.mapaReport.update({
    where: { id: reportId },
    data: { active: false },
  });
  await logReportEvent({ reportId, event: "REPORT_DELETED" });
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/reports");
}
