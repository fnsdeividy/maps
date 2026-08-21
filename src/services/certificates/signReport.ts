import { interpretationDisplayText } from "@/domain/mapa/interpretation";
import { prisma } from "@/lib/prisma";
import { logReportEvent } from "@/services/audit/log";
import { CertificateError, signPayload } from "./pkcs12";

const MAX_PFX_BYTES = 2 * 1024 * 1024;

export function assertPfxSize(size: number) {
  if (size <= 0 || size > MAX_PFX_BYTES) {
    throw new CertificateError(
      "Envie um arquivo .pfx ou .p12 de até 2 MB.",
    );
  }
}

function canonicalReportPayload(report: {
  id: string;
  examDate: Date;
  generatedMedications: string | null;
  generatedTechnicalComments: string | null;
  generatedResults: string | null;
  generatedPressureLoad: string | null;
  generatedPressurePeaks: string | null;
  generatedNightDipping: string | null;
  generatedSpecialSituations: string | null;
  generatedGeneralConsiderations: string | null;
  generatedConclusion: string | null;
  officeSystolicPressure: number | null;
  officeDiastolicPressure: number | null;
  officeHeartRate: number | null;
  patient: { name: string; birthDate: Date };
}): string {
  return JSON.stringify({
    v: 1,
    id: report.id,
    patient: report.patient.name,
    birthDate: report.patient.birthDate.toISOString().slice(0, 10),
    examDate: report.examDate.toISOString().slice(0, 10),
    office: [
      report.officeSystolicPressure,
      report.officeDiastolicPressure,
      report.officeHeartRate,
    ],
    medications: report.generatedMedications ?? "",
    technical: report.generatedTechnicalComments ?? "",
    averages: report.generatedResults ?? "",
    load: report.generatedPressureLoad ?? "",
    peaks: report.generatedPressurePeaks ?? "",
    dipping: report.generatedNightDipping ?? "",
    special: report.generatedSpecialSituations ?? "",
    interpretation: interpretationDisplayText(
      report.generatedGeneralConsiderations,
      report.generatedConclusion,
    ),
  });
}

export async function signReportWithDoctorCertificate(input: {
  reportId: string;
  userId: string;
  password: string;
}) {
  const [user, report] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { certificatePfx: true },
    }),
    prisma.mapaReport.findUniqueOrThrow({
      where: { id: input.reportId },
      include: { patient: { select: { name: true, birthDate: true } } },
    }),
  ]);

  if (!user.certificatePfx || user.certificatePfx.length === 0) {
    throw new CertificateError(
      "Cadastre o certificado digital A1 em Configurações antes de assinar.",
    );
  }

  const signed = signPayload(
    user.certificatePfx,
    input.password,
    canonicalReportPayload(report),
  );

  await prisma.mapaReport.update({
    where: { id: input.reportId },
    data: {
      signedAt: new Date(),
      signerCommonName: signed.commonName,
      signerThumbprint: signed.thumbprint,
      signatureHash: signed.payloadHash,
      signatureCms: signed.cmsBase64,
    },
  });
  await logReportEvent({ reportId: input.reportId, event: "REPORT_SIGNED" });
}
