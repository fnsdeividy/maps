import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { MapaPrintDocument } from "@/components/mapa/MapaPrintDocument";
import { PrintToolbar } from "@/components/mapa/PrintToolbar";
import { isApprover } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { markPrinted } from "@/services/reports/generateReport";
import { buildReportPrintModel } from "@/services/reports/printModel";
import { getSigningDoctor } from "@/lib/signingDoctor";
import { signApprovedReportAction } from "../../actions";
import { DigitalSignatureForm } from "../../DigitalSignatureForm";

export const dynamic = "force-dynamic";

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Nome direto do banco: a sessão (JWT) pode ficar com o nome antigo até novo login.
  const doctor = session.user.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          role: true,
          certificateCommonName: true,
          certificateThumbprint: true,
        },
      })
    : null;
  const signingDoctor = await getSigningDoctor();
  const doctorName = signingDoctor.name;
  const doctorRqe = signingDoctor.rqe;
  const role = doctor?.role ?? (session.user as { role?: string }).role;

  const status = await prisma.mapaReport.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!status) notFound();

  const approved = status.status === "APPROVED";
  const approverPreview = !approved && isApprover(role);
  // Operador só imprime laudo aprovado; aprovador pode pré-visualizar antes.
  if (!approved && !approverPreview) {
    redirect(`/reports/${id}`);
  }

  const model = await buildReportPrintModel(id, {
    showAllCharts: approverPreview,
  });
  if (!model) notFound();

  if (approved) {
    after(() => {
      void markPrinted(id);
    });
  }

  const { report } = model;
  const signApproved = signApprovedReportAction.bind(null, report.id);
  const hasCertificate = Boolean(doctor?.certificateThumbprint);
  const signError =
    error === "informe-senha-certificado"
      ? "Informe a senha do certificado digital para assinar o laudo."
      : error
        ? decodeURIComponent(error)
        : null;

  return (
    <div className="min-h-screen bg-slate-200 print:min-h-0 print:bg-white">
      <PrintToolbar preview={approverPreview} />
      {isApprover(role) && approved ? (
        <div className="mx-auto max-w-[210mm] px-4 pt-4 print:hidden">
          {signError ? (
            <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {signError}
            </p>
          ) : null}
          <DigitalSignatureForm
            action={signApproved}
            certificateCommonName={doctor?.certificateCommonName ?? null}
            hasCertificate={hasCertificate}
            returnTo="print"
            signedAt={report.signedAt}
            signerCommonName={report.signerCommonName}
          />
        </div>
      ) : null}
      <MapaPrintDocument
        assistantDoctorName={report.assistantDoctorName}
        awpPatient={model.awpPatient}
        chartPoints={model.chartPoints}
        doctorName={doctorName}
        doctorRqe={doctorRqe}
        digitalSignature={
          report.signedAt && report.signerCommonName && report.signerThumbprint
            ? {
                signedAt: report.signedAt,
                signerCommonName: report.signerCommonName,
                thumbprint: report.signerThumbprint,
              }
            : null
        }
        examDate={report.examDate}
        guidelineNote={model.guidelineNote}
        includeHistogramChart={model.includeHistogramChart}
        includePieChart={model.includePieChart}
        includeTrendChart={model.includeTrendChart}
        measurements={model.measurements}
        narrative={model.narrative}
        officeDiastolic={report.officeDiastolicPressure}
        officeHeartRate={report.officeHeartRate}
        officeSystolic={report.officeSystolicPressure}
        patient={report.patient}
        sleepWindow={model.sleepWindow}
        stats={model.stats}
        thresholds={model.thresholds}
      />
    </div>
  );
}
