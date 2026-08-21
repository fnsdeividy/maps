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

export const dynamic = "force-dynamic";

export default async function PrintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Nome direto do banco: a sessão (JWT) pode ficar com o nome antigo até novo login.
  const doctor = session.user.email
    ? await prisma.user.findUnique({ where: { email: session.user.email } })
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

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <PrintToolbar preview={approverPreview} />
      <MapaPrintDocument
        assistantDoctorName={report.assistantDoctorName}
        awpPatient={model.awpPatient}
        chartPoints={model.chartPoints}
        doctorName={doctorName}
        doctorRqe={doctorRqe}
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
