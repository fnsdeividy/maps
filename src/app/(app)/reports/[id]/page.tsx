import Link from "next/link";
import { notFound } from "next/navigation";
import { MapaPrintDocument } from "@/components/mapa/MapaPrintDocument";
import { prisma } from "@/lib/prisma";
import { isApprover, requireUser } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { REPORT_TOPICS, parseTopicFeedback } from "@/domain/mapa/reportTopics";
import {
  EMPTY_REPORT_TEXT,
  interpretationDisplayText,
} from "@/domain/mapa/interpretation";
import { SECTION_CATEGORY } from "@/services/ai/AiPhraseSelectionService";
import { getSigningDoctor } from "@/lib/signingDoctor";
import { buildReportPrintModel } from "@/services/reports/printModel";
import {
  approveReportAction,
  regenerateReportAction,
  returnReportAction,
  submitReportAction,
  updateReportSections,
} from "../actions";

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_TOPICS.map((topic) => [topic.key, topic.label]),
);

export default async function ReportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const approverView = isApprover(user.role);
  const [report, sourceFile] = await Promise.all([
    prisma.mapaReport.findUnique({
      where: { id },
      include: {
        patient: true,
        sourceFile: { select: { id: true } },
        logs: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.mapaSourceFile.findFirst({
      where: { reportId: id },
      select: { id: true },
    }),
  ]);
  if (!report) notFound();

  const approved = report.status === "APPROVED";
  const pendingApproval = report.status === "PENDING_APPROVAL";
  const changesRequested = report.status === "CHANGES_REQUESTED";
  const topicFeedback = parseTopicFeedback(report.reviewNotesByTopic);
  const importFileId = sourceFile?.id ?? report.sourceFile?.id ?? null;
  const importHref =
    !approved && importFileId ? `/reports/import/${importFileId}` : null;

  const topics = REPORT_TOPICS.map((topic) => ({
    ...topic,
    value: (report[topic.field as keyof typeof report] as string | null) ?? "",
    feedback: topicFeedback[topic.key],
  }));

  // Operador não altera laudo que está na mesa do aprovador nem laudo aprovado.
  const canEdit = !approved && !approverView && !pendingApproval;
  const save = updateReportSections.bind(null, report.id);
  const submit = submitReportAction.bind(null, report.id);
  const approve = approveReportAction.bind(null, report.id);
  const reject = returnReportAction.bind(null, report.id);
  const regenerate = regenerateReportAction.bind(null, report.id);

  // Pré-laudo do aprovador: monta o layout real do laudo com feedback embutido.
  const preLaudo = approverView && !approved;
  const printModel = preLaudo
    ? await buildReportPrintModel(report.id, { showAllCharts: true })
    : null;
  const signingDoctor = await getSigningDoctor();
  const doctorName = signingDoctor.name;
  const doctorRqe = signingDoctor.rqe;

  // Frases pré-definidas por tópico, para o revisor sugerir uma alternativa.
  const phraseOptions: Record<string, Array<{ code: string; text: string }>> = {};
  if (preLaudo) {
    const activePhrases = await prisma.reportPhrase.findMany({
      where: { active: true },
      select: { code: true, category: true, text: true },
    });
    for (const topic of REPORT_TOPICS) {
      const category = SECTION_CATEGORY[topic.key];
      phraseOptions[topic.key] = activePhrases
        .filter(
          (phrase) =>
            phrase.category === category &&
            // Sem placeholders numéricos: seguras para inserir como estão.
            !/\{[a-zA-Z]+\}/.test(phrase.text),
        )
        .map((phrase) => ({ code: phrase.code, text: phrase.text }));
    }
  }

  return (
    <div className="max-w-4xl">
      {!approved && !pendingApproval && !changesRequested ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          RASCUNHO — NÃO APROVADO
        </div>
      ) : null}
      {pendingApproval ? (
        <div className="mb-4 rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          {approverView
            ? "PRÉ-LAUDO — AGUARDANDO SUA APROVAÇÃO"
            : "AGUARDANDO APROVAÇÃO"}
        </div>
      ) : null}
      {changesRequested ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">REPROVADO — CORRIGIR PENDÊNCIAS</p>
          <p className="mt-1 text-xs">
            Veja o feedback em cada tópico abaixo e reenvie para aprovação. Se
            precisar alterar medições ou dados clínicos do exame, volte à
            conferência.
          </p>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            className="text-sm text-slate-600 underline"
            href="/reports"
          >
            Voltar aos laudos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {approverView && !approved ? "Pré-laudo" : "Revisão do laudo"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.patient.name} · exame em {formatDate(report.examDate)}
          </p>
          {importHref ? (
            <p className="mt-2 text-sm">
              <Link
                className="font-medium text-teal-800 underline"
                href={importHref}
              >
                Voltar à importação do arquivo
              </Link>
              <span className="text-slate-500">
                {" "}
                para alterar medições, PA de consultório ou situações especiais.
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {importHref ? (
            <Link
              className="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800"
              href={importHref}
            >
              Voltar à importação do arquivo
            </Link>
          ) : null}
          {(canEdit || (approverView && !approved)) ? (
            <form action={regenerate}>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
                title="Refaz a seleção de frases pela IA sem alterar o status do laudo"
                type="submit"
              >
                Reprocessar pela IA
              </button>
            </form>
          ) : null}
          {approved || approverView ? (
            <Link
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
              href={`/reports/${report.id}/print`}
            >
              {approved ? "Imprimir laudo" : "Ver laudo e gráficos"}
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Paciente</h2>
        <p className="mt-2">Nome: {report.patient.name}</p>
        <p>Nascimento: {formatDate(report.patient.birthDate)}</p>
        <p>Sexo: {report.patient.gender}</p>
        <p className="mt-2 text-slate-500">
          Médico assistente: {report.assistantDoctorName ?? "—"}
        </p>
      </section>

      {preLaudo ? (
        <ApproverPreLaudo
          approve={approve}
          doctorName={doctorName}
          doctorRqe={doctorRqe}
          feedbackByTopic={topicFeedback}
          importHref={importHref}
          phraseOptions={phraseOptions}
          printModel={printModel}
          reject={reject}
          save={save}
        />
      ) : (
        <OperatorForm
          assistantDoctorName={report.assistantDoctorName}
          canEdit={canEdit}
          changesRequested={changesRequested}
          conferenceHref={importHref}
          includeHistogramChart={report.includeHistogramChart}
          includePieChart={report.includePieChart}
          includeTrendChart={report.includeTrendChart}
          save={save}
          submit={submit}
          topics={topics}
        />
      )}

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

type TopicView = {
  key: string;
  label: string;
  value: string;
  feedback?: string;
};

/**
 * Pré-laudo do aprovador: renderiza o layout final do laudo com cada frase como
 * componente e o feedback por tópico embutido, como se estivesse montando o
 * laudo. Aprovar ou reprovar (com pendências por tópico).
 */
function ApproverPreLaudo({
  printModel,
  doctorName,
  doctorRqe,
  feedbackByTopic,
  phraseOptions,
  approve,
  reject,
  save,
  importHref,
}: {
  printModel: Awaited<ReturnType<typeof buildReportPrintModel>>;
  doctorName?: string | null;
  doctorRqe?: string | null;
  feedbackByTopic: Partial<Record<string, string>>;
  phraseOptions: Record<string, Array<{ code: string; text: string }>>;
  approve: (formData: FormData) => void;
  reject: (formData: FormData) => void;
  save: (formData: FormData) => void;
  importHref: string | null;
}) {
  if (!printModel) {
    return (
      <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Não foi possível montar a pré-visualização do laudo.
      </p>
    );
  }

  const { report } = printModel;

  return (
    <>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p className="text-slate-600">
          Revise o laudo abaixo. Você pode editar o texto, aplicar uma frase
          pronta (ela substitui o tópico na hora) ou devolver com feedback para
          o operador corrigir.
        </p>
      </div>

      <form action={save} id="approver-edit-form" />

      {/* Layout real do laudo (como sairá na impressão), com edição embutida. */}
      <section className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
        <MapaPrintDocument
          assistantDoctorName={report.assistantDoctorName}
          awpPatient={printModel.awpPatient}
          chartPoints={printModel.chartPoints}
          doctorName={doctorName}
          doctorRqe={doctorRqe}
          examDate={report.examDate}
          guidelineNote={printModel.guidelineNote}
          includeHistogramChart={printModel.includeHistogramChart}
          includePieChart={printModel.includePieChart}
          includeTrendChart={printModel.includeTrendChart}
          measurements={printModel.measurements}
          narrative={printModel.narrative}
          officeDiastolic={report.officeDiastolicPressure}
          officeHeartRate={report.officeHeartRate}
          officeSystolic={report.officeSystolicPressure}
          patient={report.patient}
          reportId={report.id}
          canEditMeasurements={Boolean(printModel.measurements.length)}
          review={{
            formId: "reject-form",
            editFormId: "approver-edit-form",
            labels: TOPIC_LABELS,
            feedbackByTopic,
            phraseOptions,
          }}
          sleepWindow={printModel.sleepWindow}
          stats={printModel.stats}
          thresholds={printModel.thresholds}
        />
      </section>

      <form
        action={reject}
        className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm"
        id="reject-form"
      >
        <label className="block">
          <span className="font-semibold">Observação geral (opcional)</span>
          <textarea
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            name="reviewNotes"
            rows={2}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Se preferir devolver, preencha o feedback em pelo menos um tópico
          (acima) ou esta observação geral. Se você mesmo corrigir o texto,
          use Salvar ou Aprovar.
        </p>
      </form>

      <div className="mt-4 flex flex-wrap gap-3">
        {importHref ? (
          <Link
            className="rounded-md border border-teal-700 px-5 py-2 font-medium text-teal-800"
            href={importHref}
          >
            Voltar à importação do arquivo
          </Link>
        ) : null}
        <button
          className="rounded-md border border-slate-300 px-5 py-2 text-slate-800"
          form="approver-edit-form"
          type="submit"
        >
          Salvar alterações
        </button>
        <button
          className="rounded-md bg-teal-700 px-5 py-2 text-white"
          form="approver-edit-form"
          formAction={approve}
          type="submit"
        >
          Aprovar laudo
        </button>
        <button
          className="rounded-md border border-red-300 px-5 py-2 font-medium text-red-700"
          form="reject-form"
          type="submit"
        >
          Reprovar com pendências
        </button>
      </div>
    </>
  );
}

/** Operador: edita os tópicos e envia para aprovação; vê pendências por tópico. */
function OperatorForm({
  topics,
  canEdit,
  changesRequested,
  conferenceHref,
  includeTrendChart,
  includeHistogramChart,
  includePieChart,
  assistantDoctorName,
  save,
  submit,
}: {
  topics: TopicView[];
  canEdit: boolean;
  changesRequested: boolean;
  conferenceHref: string | null;
  includeTrendChart: boolean;
  includeHistogramChart: boolean;
  includePieChart: boolean;
  assistantDoctorName: string | null;
  save: (formData: FormData) => void;
  submit: () => void;
}) {
  const considerations = topics.find(
    (item) => item.key === "generalConsiderations",
  )?.value;
  const conclusion = topics.find((item) => item.key === "conclusion")?.value;
  const interpretationValue =
    interpretationDisplayText(considerations, conclusion) ||
    conclusion ||
    EMPTY_REPORT_TEXT;

  return (
    <>
      <form action={save} className="mt-4 space-y-4">
        <label className="block rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <span className="font-semibold">Médico assistente</span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={assistantDoctorName ?? ""}
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
              defaultChecked={includeTrendChart}
              disabled={!canEdit}
              name="includeTrendChart"
              type="checkbox"
            />
            Tendência (BP vs Tempo)
          </label>
          <label className="flex items-center gap-2">
            <input
              defaultChecked={includeHistogramChart}
              disabled={!canEdit}
              name="includeHistogramChart"
              type="checkbox"
            />
            Histograma
          </label>
          <label className="flex items-center gap-2">
            <input
              defaultChecked={includePieChart}
              disabled={!canEdit}
              name="includePieChart"
              type="checkbox"
            />
            Gráfico de pizza
          </label>
        </fieldset>
        {topics.map((topic) => {
          const emptySpecial =
            topic.key === "specialSituations" &&
            (!topic.value.trim() || topic.value.trim() === EMPTY_REPORT_TEXT);
          const hideConsiderations = topic.key === "generalConsiderations";
          if ((emptySpecial || hideConsiderations) && !topic.feedback) {
            return (
              <input
                key={topic.key}
                name={topic.key}
                type="hidden"
                value={topic.value}
              />
            );
          }
          return (
            <label
              className="block rounded-lg border border-slate-200 bg-white p-5 text-sm"
              key={topic.key}
            >
              <span className="font-semibold">{topic.label}</span>
              {changesRequested && topic.feedback ? (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  Pendência: {topic.feedback}
                </p>
              ) : null}
              <textarea
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={
                  topic.key === "conclusion" ? interpretationValue : topic.value
                }
                name={topic.key}
                readOnly={!canEdit}
                rows={4}
              />
            </label>
          );
        })}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-md border border-slate-300 px-4 py-2" type="submit">
              Salvar edição
            </button>
            {conferenceHref ? (
              <Link className="text-sm font-medium text-teal-800 underline" href={conferenceHref}>
                Voltar à importação do arquivo
              </Link>
            ) : null}
          </div>
        ) : conferenceHref ? (
          <p className="text-sm">
            <Link className="font-medium text-teal-800 underline" href={conferenceHref}>
              Voltar à importação do arquivo
            </Link>
          </p>
        ) : null}
      </form>

      {canEdit ? (
        <form action={submit} className="mt-4">
          <button className="rounded-md bg-sky-700 px-4 py-2 text-white" type="submit">
            Enviar para aprovação
          </button>
        </form>
      ) : null}
    </>
  );
}
