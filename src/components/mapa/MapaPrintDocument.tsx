import type { ReactNode } from "react";
import { BpHistogramCharts } from "@/components/BpHistogramCharts";
import { BpPieCharts } from "@/components/BpPieCharts";
import { BpTimeChart } from "@/components/BpTimeChart";
import { guidelineFooter, stripGuidelineFooter } from "@/domain/mapa/config/guideline";
import { PrintMeasurementsTable } from "@/components/mapa/PrintMeasurementsTable";
import { ApproverTopicEditor } from "@/components/mapa/ApproverTopicEditor";
import { interpretationDisplayText } from "@/domain/mapa/interpretation";
import type { MapaThresholds } from "@/domain/mapa/config/thresholds";
import { mapAwpGenderCode } from "@/domain/mapa/import/awp/patientData";
import type { AwpPatientData } from "@/domain/mapa/import/awp/types";
import type { MapaPrintStatistics } from "@/domain/mapa/services/MapaPrintStatistics";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { formatInteger, formatNumber, formatPercent } from "@/lib/numbers";

type ReportNarrative = {
  medications?: string | null;
  technicalComments?: string | null;
  averagePressure?: string | null;
  pressureLoad?: string | null;
  pressurePeaks?: string | null;
  nightDipping?: string | null;
  specialSituations?: string | null;
  generalConsiderations?: string | null;
  conclusion?: string | null;
};

type PatientInfo = {
  name: string;
  birthDate: Date;
  gender: string;
  document?: string | null;
};

function genderLabel(gender: string): string {
  if (gender === "M") return "Masculino";
  if (gender === "F") return "Feminino";
  return "Outro";
}

function ageAt(birthDate: Date, on: Date): number {
  let age = on.getFullYear() - birthDate.getFullYear();
  const monthDiff = on.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function momento(value: Date | null | undefined): string {
  if (!value) return "—";
  return formatDateTime(value);
}

function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function PrintHeader({
  patientName,
  patientId,
  examStart,
  examEnd,
  durationLabel,
  assistantDoctorName,
}: {
  patientName: string;
  patientId?: string | null;
  examStart: Date | null;
  examEnd: Date | null;
  durationLabel: string | null;
  assistantDoctorName?: string | null;
}) {
  return (
    <header className="print-header print-keep">
      <div className="flex justify-center">
        {/* img nativo: next/image costuma falhar no diálogo de impressão */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Amacor"
          className="h-14 w-auto object-contain"
          height={56}
          src="/logo.png"
          width={220}
        />
      </div>
      <div className="mt-3 border border-black text-[11px]">
        <div className="grid grid-cols-2 border-b border-black">
          <div className="border-r border-black px-2 py-1">
            <span className="font-semibold">Nome do paciente:</span> {patientName}
          </div>
          <div className="px-2 py-1">
            <span className="font-semibold">ID do paciente:</span> {dash(patientId)}
          </div>
        </div>
        <div className="grid grid-cols-3 border-b border-black">
          <div className="border-r border-black px-2 py-1">
            <span className="font-semibold">Início do teste:</span>{" "}
            {examStart ? formatDateTime(examStart) : "—"}
          </div>
          <div className="border-r border-black px-2 py-1">
            <span className="font-semibold">Final do teste:</span>{" "}
            {examEnd ? formatDateTime(examEnd) : "—"}
          </div>
          <div className="px-2 py-1">
            <span className="font-semibold">Duração:</span> {dash(durationLabel)}
          </div>
        </div>
        <div className="px-2 py-1">
          <span className="font-semibold">Médico assistente:</span>{" "}
          {dash(assistantDoctorName)}
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="print-section-title mt-3 border-y border-black py-1 text-center text-sm font-bold uppercase tracking-wide">
      {children}
    </h2>
  );
}

function isFilled(text?: string | null): text is string {
  const value = text?.trim();
  return Boolean(value) && value !== "Não informado.";
}

/**
 * Remove o checklist "Campo: sim/não/não informado" de laudos antigos.
 * Só o que foi de fato declarado (frases como "Relato de tabagismo.") permanece.
 */
function withoutFlagChecklist(text: string): string {
  return text
    .replace(
      /(?:Gestante|Uso de álcool|Tabagismo|Insônia|Uso de cafeína)\s*:\s*(?:não informado|não|sim)\.?/gi,
      "",
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
}

/** Remove linha de PA de consultório do texto gerado — ela vai no campo dedicado. */
function medicationsWithoutOfficeBp(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^PA de Consult[oó]rio/i.test(line))
    .join("\n");
}

function CommentBlock({
  title,
  children,
  emphasized = false,
}: {
  title: string;
  children: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className={emphasized ? "print-keep mt-2 border-t border-black pt-3" : "print-keep"}>
      <p
        className={
          emphasized
            ? "text-[12px] font-bold uppercase tracking-wide underline underline-offset-2"
            : "font-bold"
        }
      >
        {title}
      </p>
      <div
        className={`whitespace-pre-wrap ${emphasized ? "mt-2 text-[12px] font-semibold" : "mt-1"}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Quebra o texto de um tópico nas frases que o compõem, para o aprovador ver
 * cada frase como um "componente" montando o laudo. Não corta em números com
 * ponto decimal (ex.: 147/95.1) porque só divide antes de letra maiúscula.
 */
function splitPhrases(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+(?=[A-ZÀ-Ú])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Frases do tópico renderizadas como blocos (impressão do pré-laudo). */
function PhraseComponents({ text }: { text: string }) {
  const phrases = splitPhrases(text);
  if (phrases.length === 0) return <p>—</p>;
  return (
    <div className="space-y-1">
      {phrases.map((phrase, index) => (
        <div
          className="rounded-md border border-teal-200 bg-teal-50/70 px-2 py-1"
          key={`${index}-${phrase.slice(0, 12)}`}
        >
          {phrase}
        </div>
      ))}
    </div>
  );
}

function StatsTable({
  title,
  countLabel,
  stats,
}: {
  title: string;
  countLabel: string;
  stats: NonNullable<MapaPrintStatistics["awake"]> | MapaPrintStatistics["overall"];
}) {
  const rows = [
    ["Sistólica (mmHg)", stats.systolic],
    ["Diastólica (mmHg)", stats.diastolic],
    ["Frequência cardíaca (BPM)", stats.heartRate],
    ["MAP (mmHg)", stats.meanArterialPressure],
    ["PP (mmHg)", stats.pulsePressure],
  ] as const;

  return (
    <section className="print-keep mt-4 text-[10px]">
      <p className="font-semibold">{title}</p>
      <p className="mb-1">{countLabel}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2" />
            <th className="py-1 pr-2">Máximo</th>
            <th className="py-1 pr-2">Momento</th>
            <th className="py-1 pr-2">Mínimo</th>
            <th className="py-1 pr-2">Momento</th>
            <th className="py-1 pr-2">Média</th>
            <th className="py-1 pr-2">SD</th>
            <th className="py-1 pr-2">SE</th>
            <th className="py-1">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, series]) => (
            <tr className="border-b border-slate-300" key={label}>
              <td className="py-1 pr-2 font-medium">{label}</td>
              <td className="py-1 pr-2">{formatInteger(series.max?.value)}</td>
              <td className="py-1 pr-2">
                {series.max?.at ? formatTime(series.max.at) : "—"}
              </td>
              <td className="py-1 pr-2">{formatInteger(series.min?.value)}</td>
              <td className="py-1 pr-2">
                {series.min?.at ? formatTime(series.min.at) : "—"}
              </td>
              <td className="py-1 pr-2">{formatNumber(series.mean)}</td>
              <td className="py-1 pr-2">{formatNumber(series.sd)}</td>
              <td className="py-1 pr-2">{formatNumber(series.se)}</td>
              <td className="py-1">
                {series.cv != null ? `${formatNumber(series.cv)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1">
        Sistólica &gt; {stats.systolicThreshold} mmHg{" "}
        {formatPercent(stats.systolicLoadPercent)}
      </p>
      <p>
        Diastólica &gt; {stats.diastolicThreshold} mmHg{" "}
        {formatPercent(stats.diastolicLoadPercent)}
      </p>
    </section>
  );
}

export function MapaPrintDocument({
  patient,
  awpPatient,
  examDate,
  officeSystolic,
  officeDiastolic,
  officeHeartRate,
  doctorName,
  doctorRqe,
  assistantDoctorName,
  thresholds,
  stats,
  narrative,
  chartPoints = [],
  sleepWindow = null,
  measurements = [],
  includeTrendChart = true,
  includeHistogramChart = true,
  includePieChart = true,
  guidelineNote = guidelineFooter,
  review = null,
  reportId,
  canEditMeasurements = false,
}: {
  patient: PatientInfo;
  awpPatient?: AwpPatientData | null;
  examDate: Date;
  officeSystolic?: number | null;
  officeDiastolic?: number | null;
  officeHeartRate?: number | null;
  doctorName?: string | null;
  doctorRqe?: string | null;
  assistantDoctorName?: string | null;
  thresholds: MapaThresholds;
  stats: MapaPrintStatistics | null;
  narrative: ReportNarrative;
  chartPoints?: Array<{
    at: Date;
    systolic: number;
    diastolic: number;
    heartRate?: number;
  }>;
  sleepWindow?: { start: string; end: string } | null;
  measurements?: Array<{
    index: number;
    at: Date;
    systolic: number;
    diastolic: number;
    meanArterialPressure?: number | null;
    heartRate?: number | null;
    valid: boolean;
    discarded?: boolean;
    observation?: string | null;
  }>;
  includeTrendChart?: boolean;
  includeHistogramChart?: boolean;
  includePieChart?: boolean;
  guidelineNote?: string;
  /**
   * Modo pré-laudo do aprovador: cada tópico é editável, com frases prontas
   * e feedback para devolver ao operador.
   */
  review?: {
    formId: string;
    editFormId: string;
    labels: Record<string, string>;
    feedbackByTopic?: Partial<Record<string, string>>;
    phraseOptions?: Partial<Record<string, Array<{ code: string; text: string }>>>;
  } | null;
  reportId?: string;
  canEditMeasurements?: boolean;
}) {
  const age = ageAt(patient.birthDate, examDate);
  const sexLabel = genderLabel(
    awpPatient?.genderCode != null
      ? mapAwpGenderCode(awpPatient.genderCode)
      : patient.gender,
  );

  const medsBody = isFilled(narrative.medications)
    ? medicationsWithoutOfficeBp(narrative.medications)
    : "Não há relato de uso de medicações durante o exame.";

  const specialBody = isFilled(narrative.specialSituations)
    ? withoutFlagChecklist(narrative.specialSituations)
    : "";

  const officeBpLine = `PA de Consultório: BE sentado: ${
    officeSystolic != null ? formatInteger(officeSystolic) : "—"
  }/${officeDiastolic != null ? formatInteger(officeDiastolic) : "—"} mmHg. FC: ${
    officeHeartRate != null ? formatInteger(officeHeartRate) : "—"
  }.`;

  const commentFrames: Array<{
    title: string;
    text: string;
    emphasized?: boolean;
    topicKeys: string[];
  }> = [
    isFilled(narrative.technicalComments)
      ? {
          title: "Qualidade técnica:",
          text: narrative.technicalComments,
          topicKeys: ["technicalComments"],
        }
      : null,
    isFilled(narrative.averagePressure)
      ? {
          title: "Médias pressóricas:",
          text: narrative.averagePressure,
          topicKeys: ["averagePressure"],
        }
      : null,
    isFilled(narrative.pressureLoad)
      ? {
          title: "Cargas pressóricas:",
          text: narrative.pressureLoad,
          topicKeys: ["pressureLoad"],
        }
      : null,
    isFilled(narrative.pressurePeaks)
      ? {
          title: "Picos pressóricos:",
          text: narrative.pressurePeaks,
          topicKeys: ["pressurePeaks"],
        }
      : null,
    isFilled(narrative.nightDipping)
      ? {
          title: "Descenso pressórico noturno:",
          text: narrative.nightDipping,
          topicKeys: ["nightDipping"],
        }
      : null,
    {
      title: "Interpretação dos resultados:",
      emphasized: true,
      topicKeys: ["conclusion"],
      text: (() => {
        const body = stripGuidelineFooter(
          interpretationDisplayText(
            narrative.generalConsiderations,
            narrative.conclusion,
          ),
          guidelineNote,
        );
        return body || "—";
      })(),
    },
  ].filter(
    (
      frame,
    ): frame is {
      title: string;
      text: string;
      emphasized?: boolean;
      topicKeys: string[];
    } => frame != null,
  );

  const examStart = stats?.examStart ?? examDate;
  const examEnd = stats?.examEnd ?? null;
  const headerProps = {
    assistantDoctorName,
    durationLabel: stats?.durationLabel ?? null,
    examEnd,
    examStart,
    patientId: awpPatient?.patientId ?? patient.document,
    patientName: patient.name,
  };

  return (
    <div className="mapa-print text-black">
      {/* Página 1 — identificação + resultados (sem texto longo) */}
      <article className="print-page mx-auto max-w-[210mm] bg-white p-6 print:p-0">
        <PrintHeader {...headerProps} />

        <SectionTitle>Informações do paciente</SectionTitle>
        <div className="print-keep mt-2 grid grid-cols-2 gap-x-6 text-[11px]">
          <dl className="space-y-1">
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">ID do paciente:</dt>
              <dd>{dash(awpPatient?.patientId ?? patient.document)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">Nome do paciente:</dt>
              <dd>{patient.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">Endereço:</dt>
              <dd>{dash(awpPatient?.address)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">Ambulatório No.:</dt>
              <dd>{dash(awpPatient?.outpatientNumber)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">No. de admissão:</dt>
              <dd>{dash(awpPatient?.admissionNumber)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">Leito No.:</dt>
              <dd>{dash(awpPatient?.bedNumber)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">No. de departamento:</dt>
              <dd>{dash(awpPatient?.departmentNumber)}</dd>
            </div>
          </dl>
          <dl className="space-y-1">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold">Idade:</dt>
              <dd>{age} anos</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold">Sexo:</dt>
              <dd>{sexLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold">Altura:</dt>
              <dd>
                {awpPatient?.heightCm != null ? `${awpPatient.heightCm} cm` : "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold">Peso:</dt>
              <dd>
                {awpPatient?.weightKg != null ? `${awpPatient.weightKg} kg` : "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold">Aniversário:</dt>
              <dd>{formatDate(patient.birthDate)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold">Email:</dt>
              <dd>{dash(awpPatient?.email)}</dd>
            </div>
          </dl>
        </div>

        <SectionTitle>Medicações atuais</SectionTitle>
        <div className="print-keep mt-2 border border-black p-2 text-[11px] leading-relaxed">
          {review ? (
            <>
              <div className="hidden print:block">
                <p className="whitespace-pre-wrap">{medsBody}</p>
              </div>
              <ApproverTopicEditor
                editFormId={review.editFormId}
                feedback={review.feedbackByTopic?.medications}
                label={review.labels.medications ?? "Medicações atuais"}
                phrases={review.phraseOptions?.medications}
                rejectFormId={review.formId}
                topicKey="medications"
                value={medsBody}
              />
            </>
          ) : (
            <p className="whitespace-pre-wrap">{medsBody}</p>
          )}
          <p className="mt-2 font-medium">{officeBpLine}</p>
        </div>

        {specialBody ? (
          <>
            <SectionTitle>Situações especiais</SectionTitle>
            <div className="print-keep mt-2 border border-black p-2 text-[11px] leading-relaxed">
              {review ? (
                <>
                  <div className="hidden print:block">
                    <PhraseComponents text={specialBody} />
                  </div>
                  <ApproverTopicEditor
                    editFormId={review.editFormId}
                    feedback={review.feedbackByTopic?.specialSituations}
                    label={review.labels.specialSituations ?? "Situações especiais"}
                    phrases={review.phraseOptions?.specialSituations}
                    rejectFormId={review.formId}
                    topicKey="specialSituations"
                    value={specialBody}
                  />
                </>
              ) : (
                <p className="whitespace-pre-wrap">{specialBody}</p>
              )}
            </div>
          </>
        ) : null}

        <SectionTitle>Resultado dos exames</SectionTitle>
        <div className="mt-2 space-y-3 text-[11px]">
          <div className="print-keep">
            <p className="font-semibold">Médias pressóricas</p>
            <table className="mt-1 w-full">
              <tbody>
                <tr>
                  <td className="py-0.5">Todas médias de BP</td>
                  <td className="py-0.5 text-right font-medium">
                    {formatInteger(stats?.avg24hSystolic)} /{" "}
                    {formatInteger(stats?.avg24hDiastolic)} mmHg
                  </td>
                  <td className="w-44 py-0.5 pl-4 text-slate-600">
                    Limite normal: {thresholds.full24Hours.systolic}×
                    {thresholds.full24Hours.diastolic} mmHg
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5">Médias de BP dia</td>
                  <td className="py-0.5 text-right font-medium">
                    {formatInteger(stats?.awakeAvgSystolic)} /{" "}
                    {formatInteger(stats?.awakeAvgDiastolic)} mmHg
                  </td>
                  <td className="py-0.5 pl-4 text-slate-600">
                    Limite normal: {thresholds.awake.systolic}×{thresholds.awake.diastolic}{" "}
                    mmHg
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5">Médias de BP noite</td>
                  <td className="py-0.5 text-right font-medium">
                    {formatInteger(stats?.sleepAvgSystolic)} /{" "}
                    {formatInteger(stats?.sleepAvgDiastolic)} mmHg
                  </td>
                  <td className="py-0.5 pl-4 text-slate-600">
                    Limite normal: {thresholds.sleep.systolic}×{thresholds.sleep.diastolic}{" "}
                    mmHg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="print-keep">
            <p className="font-semibold">Cargas PA</p>
            <div className="mt-1 grid grid-cols-2 gap-4">
              <div>
                <p className="underline">Dia</p>
                <p>
                  SIS: {formatPercent(stats?.awakeSystolicLoad)} (limite{" "}
                  {thresholds.awake.systolic} mmHg)
                </p>
                <p>
                  DIA: {formatPercent(stats?.awakeDiastolicLoad)} (limite{" "}
                  {thresholds.awake.diastolic} mmHg)
                </p>
              </div>
              <div>
                <p className="underline">Noite</p>
                <p>
                  SIS: {formatPercent(stats?.sleepSystolicLoad)} (limite{" "}
                  {thresholds.sleep.systolic} mmHg)
                </p>
                <p>
                  DIA: {formatPercent(stats?.sleepDiastolicLoad)} (limite{" "}
                  {thresholds.sleep.diastolic} mmHg)
                </p>
              </div>
            </div>
          </div>

          <div className="print-keep">
            <p className="font-semibold">Valores extremos</p>
            <table className="mt-1 w-full">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1" />
                  <th className="py-1">Valor</th>
                  <th className="py-1">Momento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-0.5">SIS Máxima</td>
                  <td>{formatInteger(stats?.peakSystolic?.value)} mmHg</td>
                  <td>{momento(stats?.peakSystolic?.at)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">DIA Máxima</td>
                  <td>{formatInteger(stats?.peakDiastolic?.value)} mmHg</td>
                  <td>{momento(stats?.peakDiastolic?.at)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">SIS Mínima</td>
                  <td>{formatInteger(stats?.troughSystolic?.value)} mmHg</td>
                  <td>{momento(stats?.troughSystolic?.at)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">DIA Mínima</td>
                  <td>{formatInteger(stats?.troughDiastolic?.value)} mmHg</td>
                  <td>{momento(stats?.troughDiastolic?.at)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="print-keep grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Ritmo circadiano</p>
              <p>
                Queda noturna SIS: {formatPercent(stats?.systolicNightDipping)}
              </p>
              <p>
                Queda noturna DIA: {formatPercent(stats?.diastolicNightDipping)}
              </p>
              <p className="text-slate-600">Normal: 10%–20%</p>
            </div>
            <div>
              <p className="font-semibold">Coeficiente de variação</p>
              <table className="mt-1 w-full">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="py-1" />
                    <th className="py-1">SIS</th>
                    <th className="py-1">DIA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-0.5">Todos</td>
                    <td>{formatPercent(stats?.cvOverallSystolic)}</td>
                    <td>{formatPercent(stats?.cvOverallDiastolic)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5">Dia</td>
                    <td>{formatPercent(stats?.cvAwakeSystolic)}</td>
                    <td>{formatPercent(stats?.cvAwakeDiastolic)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5">Noite</td>
                    <td>{formatPercent(stats?.cvSleepSystolic)}</td>
                    <td>{formatPercent(stats?.cvSleepDiastolic)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-600">
          Este relatório somente pode ser usado para referência clínica
        </p>
      </article>

      {/* Página 2 — estatísticas detalhadas */}
      {stats ? (
        <article className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0">
          <PrintHeader {...headerProps} />

          <p className="mt-3 text-center text-[11px]">
            Amostras usadas/tentativas: {stats.validCount}/{stats.totalAttempts}
            {stats.validPercentage != null
              ? ` (${formatNumber(stats.validPercentage)}%)`
              : ""}
          </p>

          <StatsTable
            countLabel={`Total das amostras estatísticas usadas no geral: ${stats.overall.count}`}
            stats={stats.overall}
            title="Estatísticas BP"
          />

          {stats.awake ? (
            <StatsTable
              countLabel={`Total de amostras utilizadas nas estatísticas acordado: ${stats.awake.count}`}
              stats={stats.awake}
              title="Estatística do total de amostras utilizadas nas estatísticas acordado"
            />
          ) : null}

          {stats.sleep ? (
            <StatsTable
              countLabel={`Total de amostras usadas dormindo: ${stats.sleep.count}`}
              stats={stats.sleep}
              title="Estatística do total de amostras usadas dormindo"
            />
          ) : null}

          <p className="mt-8 text-center text-[10px] text-slate-600">
            Este relatório somente pode ser usado para referência clínica
          </p>
        </article>
      ) : null}

      {/* Página do gráfico de tendência */}
      {includeTrendChart && chartPoints.length >= 2 ? (
        <article className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0">
          <PrintHeader {...headerProps} />
          <SectionTitle>Pressão ao longo do exame</SectionTitle>
          <div className="mt-4">
            <BpTimeChart
              limits={{ awake: thresholds.awake, sleep: thresholds.sleep }}
              points={chartPoints}
              sleepWindow={sleepWindow}
              variant="print"
            />
          </div>
          <p className="mt-8 text-center text-[10px] text-slate-600">
            Este relatório somente pode ser usado para referência clínica
          </p>
        </article>
      ) : null}

      {/* Página Histograma(Todos) */}
      {includeHistogramChart && chartPoints.length > 0 ? (
        <article className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0">
          <PrintHeader {...headerProps} />
          <div className="mt-3">
            <BpHistogramCharts points={chartPoints} variant="print" />
          </div>
          <p className="mt-6 text-center text-[10px] text-slate-600">
            Este relatório somente pode ser usado para referência clínica
          </p>
        </article>
      ) : null}

      {/* Página Gráfico de pizza(Todos) */}
      {includePieChart && chartPoints.length > 0 ? (
        <article className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0">
          <PrintHeader {...headerProps} />
          <div className="mt-3">
            <BpPieCharts
              diastolicHigh={thresholds.awake.diastolic}
              points={chartPoints}
              systolicHigh={thresholds.awake.systolic}
              variant="print"
            />
          </div>
          <p className="mt-6 text-center text-[10px] text-slate-600">
            Este relatório somente pode ser usado para referência clínica
          </p>
        </article>
      ) : null}

      {/* Dados medidos — todas as medições do exame */}
      {measurements.length > 0 ? (
        <article className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0">
          <PrintHeader {...headerProps} />
          <SectionTitle>Dados medidos</SectionTitle>
          <PrintMeasurementsTable
            editable={canEditMeasurements}
            measurements={measurements}
            reportId={reportId}
          />
          <p className="mt-8 text-center text-[10px] text-slate-600">
            Este relatório somente pode ser usado para referência clínica
          </p>
        </article>
      ) : null}

      {/* Última página — comentários, conclusão e assinaturas */}
      <article className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0">
        <PrintHeader {...headerProps} />

        <SectionTitle>Comentários e diagnósticos</SectionTitle>
        <div className="mt-2 space-y-4 border border-black p-3 text-[11px] leading-relaxed">
          {commentFrames.length > 0 ? (
            commentFrames.map((frame) => (
              <CommentBlock
                emphasized={frame.emphasized}
                key={frame.title}
                title={frame.title}
              >
                {review ? (
                  <>
                    <div className="hidden print:block">
                      <PhraseComponents text={frame.text} />
                    </div>
                    {frame.topicKeys.map((topicKey) => (
                      <ApproverTopicEditor
                        editFormId={review.editFormId}
                        feedback={review.feedbackByTopic?.[topicKey]}
                        key={topicKey}
                        label={review.labels[topicKey] ?? frame.title}
                        phrases={review.phraseOptions?.[topicKey]}
                        rejectFormId={review.formId}
                        topicKey={topicKey}
                        value={frame.text}
                      />
                    ))}
                  </>
                ) : (
                  frame.text
                )}
              </CommentBlock>
            ))
          ) : (
            <p>—</p>
          )}
          <p className="print-keep">
            <span className="font-bold">Obs.:</span> {guidelineNote}
          </p>
        </div>

        <div className="print-keep mt-10 text-center text-[11px]">
          <p>
            <span className="font-semibold">Data:</span> {formatDate(examDate)}
          </p>
          <div className="mx-auto mt-10 mb-2 w-56 border-b border-black" />
          <p className="font-semibold">{dash(doctorName)}</p>
          <p>Cardiologista</p>
          <p>RQE: {doctorRqe ?? "37228"}</p>
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-600">
          Este relatório somente pode ser usado para referência clínica
        </p>
      </article>
    </div>
  );
}
