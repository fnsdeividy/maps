import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isApprover, requireUser } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import {
  approveReportAction,
  returnReportAction,
  submitReportAction,
  updateReportSections,
} from "../actions";

export default async function ReportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const approverView = isApprover(user.role);
  const report = await prisma.mapaReport.findUnique({
    where: { id },
    include: { patient: true, logs: { orderBy: { createdAt: "desc" } } },
  });
  if (!report) notFound();

  const approved = report.status === "APPROVED";
  const pendingApproval = report.status === "PENDING_APPROVAL";
  const changesRequested = report.status === "CHANGES_REQUESTED";
  // Operador não altera laudo que está na mesa do aprovador nem laudo aprovado.
  const canEdit = !approved && (approverView || !pendingApproval);
  const save = updateReportSections.bind(null, report.id);
  const submit = submitReportAction.bind(null, report.id);
  const approve = approveReportAction.bind(null, report.id);
  const returnWithNotes = returnReportAction.bind(null, report.id);

  return (
    <div className="max-w-4xl">
      {!approved && !pendingApproval && !changesRequested ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          RASCUNHO — NÃO APROVADO
        </div>
      ) : null}
      {pendingApproval ? (
        <div className="mb-4 rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          AGUARDANDO APROVAÇÃO
        </div>
      ) : null}
      {changesRequested ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">DEVOLVIDO COM PENDÊNCIAS</p>
          {report.reviewNotes ? (
            <p className="mt-1 whitespace-pre-wrap">{report.reviewNotes}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Revisão do laudo</h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.patient.name} · exame em {formatDate(report.examDate)}
          </p>
        </div>
        {approved ? (
          <Link
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
            href={`/reports/${report.id}/print`}
          >
            Imprimir laudo
          </Link>
        ) : approverView ? (
          <Link
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
            href={`/reports/${report.id}/print`}
          >
            Ver laudo e gráficos
          </Link>
        ) : null}
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Paciente</h2>
        <p className="mt-2">Nome: {report.patient.name}</p>
        <p>Nascimento: {formatDate(report.patient.birthDate)}</p>
        <p>Sexo: {report.patient.gender}</p>
      </section>

      <form action={save} className="mt-4 space-y-4">
        <label className="block rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <span className="font-semibold">Médico assistente</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={report.assistantDoctorName ?? ""}
            disabled={!canEdit}
            name="assistantDoctorName"
            required={canEdit}
          />
        </label>
        <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <legend className="px-1 font-semibold">Gráficos no laudo</legend>
          <p className="text-xs text-slate-500">
            Escolha quais páginas de gráfico entram na impressão.
          </p>
          <label className="flex items-center gap-2">
            <input
              defaultChecked={report.includeTrendChart}
              disabled={!canEdit}
              name="includeTrendChart"
              type="checkbox"
            />
            Tendência (BP vs Tempo)
          </label>
          <label className="flex items-center gap-2">
            <input
              defaultChecked={report.includeHistogramChart}
              disabled={!canEdit}
              name="includeHistogramChart"
              type="checkbox"
            />
            Histograma
          </label>
          <label className="flex items-center gap-2">
            <input
              defaultChecked={report.includePieChart}
              disabled={!canEdit}
              name="includePieChart"
              type="checkbox"
            />
            Gráfico de pizza
          </label>
        </fieldset>
        {(
          [
            ["medications", "Medicações atuais", report.generatedMedications],
            [
              "technicalComments",
              "Comentários sobre o desempenho técnico",
              report.generatedTechnicalComments,
            ],
            [
              "averagePressure",
              "Médias pressóricas",
              report.generatedResults,
            ],
            [
              "pressureLoad",
              "Cargas pressóricas",
              report.generatedPressureLoad,
            ],
            [
              "pressurePeaks",
              "Picos pressóricos",
              report.generatedPressurePeaks,
            ],
            [
              "nightDipping",
              "Descenso pressórico no sono",
              report.generatedNightDipping,
            ],
            [
              "specialSituations",
              "Situações especiais",
              report.generatedSpecialSituations,
            ],
            [
              "generalConsiderations",
              "Considerações gerais",
              report.generatedGeneralConsiderations,
            ],
            ["conclusion", "Interpretação dos resultados", report.generatedConclusion],
          ] as const
        ).map(([name, label, value]) => (
          <label className="block rounded-lg border border-slate-200 bg-white p-5 text-sm" key={name}>
            <span className="font-semibold">{label}</span>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              defaultValue={value ?? ""}
              name={name}
              readOnly={!canEdit}
              rows={4}
            />
          </label>
        ))}
        {canEdit ? (
          <div className="flex gap-3">
            <button className="rounded-md border border-slate-300 px-4 py-2" type="submit">
              Salvar edição
            </button>
          </div>
        ) : null}
      </form>

      {!approved && !pendingApproval && canEdit ? (
        <form action={submit} className="mt-4">
          <button className="rounded-md bg-sky-700 px-4 py-2 text-white" type="submit">
            Enviar para aprovação
          </button>
        </form>
      ) : null}

      {approverView && !approved ? (
        <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Aprovação</h2>
          <p className="text-sm text-slate-600">
            Antes de aprovar, revise o laudo completo — tendência, histograma e pizza
            ficam em{" "}
            <Link
              className="font-medium text-teal-700 underline"
              href={`/reports/${report.id}/print`}
            >
              Ver laudo e gráficos
            </Link>
            .
          </p>
          <form action={approve}>
            <button className="rounded-md bg-teal-700 px-4 py-2 text-white" type="submit">
              Aprovar laudo
            </button>
          </form>
          <form action={returnWithNotes} className="space-y-2">
            <label className="block text-sm">
              <span className="font-semibold">Devolver com pendências</span>
              <textarea
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                name="reviewNotes"
                placeholder="Descreva o que precisa ser corrigido"
                required
                rows={3}
              />
            </label>
            <button
              className="rounded-md border border-red-300 px-4 py-2 text-red-700"
              type="submit"
            >
              Devolver para correção
            </button>
          </form>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-semibold">Auditoria</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {report.logs.map((log) => (
            <li key={log.id}>
              {log.createdAt.toLocaleString("pt-BR")} — {log.event}
              {log.model ? ` (${log.model})` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
