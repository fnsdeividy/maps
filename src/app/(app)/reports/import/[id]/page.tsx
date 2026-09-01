import Link from "next/link";
import { notFound } from "next/navigation";
import { BpHistogramCharts } from "@/components/BpHistogramCharts";
import { BpPieCharts } from "@/components/BpPieCharts";
import { BpTimeChart } from "@/components/BpTimeChart";
import { Field } from "@/components/Field";
import { MeasurementObservationTable } from "@/components/MeasurementObservationTable";
import { MedicationFields } from "@/components/MedicationFields";
import { SpecialSituationFlags } from "@/components/SpecialSituationFlags";
import { ClinicalSituationCheckboxes } from "@/components/ClinicalSituationCheckboxes";
import { formatDate, formatDateTime, toInputDate } from "@/lib/dates";
import {
  formatFileSize,
  formatInteger,
  formatNumber,
  formatPercent,
  formatPressurePair,
} from "@/lib/numbers";
import { getAwpImportPreview } from "@/services/imports/awpImport";
import type { ParseWarning } from "@/domain/mapa/import/awp/types";
import { isTriStateFlag, type TriStateFlag } from "@/domain/mapa/specialFlags";
import { confirmAwpImportAction, discardAwpImportAction } from "../actions";

const CONFIDENCE_LABEL: Record<string, string> = {
  VERIFIED: "Conferido contra o software oficial",
  PARTIAL: "Parcial — estrutura lida, resultado ainda não conferido",
  UNKNOWN: "Desconhecida — importação bloqueada",
};

function groupWarnings(warnings: ParseWarning[]) {
  const groups = new Map<string, { code: string; message: string; records: number[] }>();
  for (const warning of warnings) {
    const group = groups.get(warning.code) ?? {
      code: warning.code,
      message: warning.message,
      records: [],
    };
    if (warning.recordIndex !== undefined) group.records.push(warning.recordIndex);
    groups.set(warning.code, group);
  }
  return [...groups.values()];
}

function sleepSourceLabel(source: string | null): string {
  if (source === "DEVICE_CONFIGURATION") return "período configurado no equipamento";
  if (source === "FILE") return "informada pelo arquivo";
  if (source === "MANUAL") return "informada manualmente";
  return "";
}

function asTriState(value: string): TriStateFlag | undefined {
  return isTriStateFlag(value) ? value : undefined;
}

export default async function AwpImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sleepStart?: string; sleepEnd?: string; error?: string }>;
}) {
  const { id } = await params;
  const { sleepStart, sleepEnd, error } = await searchParams;

  const preview = await getAwpImportPreview(id, { start: sleepStart, end: sleepEnd });
  if (!preview) notFound();

  const { sourceFile, result, metrics, sleepWindow, sleepSource, canImport } = preview;
  const linkedReport = sourceFile.report;
  const alreadyImported = Boolean(linkedReport);
  const reportLocked = linkedReport?.status === "APPROVED";

  const confirm = confirmAwpImportAction.bind(null, sourceFile.id);
  const discard = discardAwpImportAction.bind(null, sourceFile.id);
  const confirmFormId = `confirm-awp-${sourceFile.id}`;
  const warnings = groupWarnings(result.warnings);
  const patientData = result.patientData;
  const linkedPatient = sourceFile.patient;
  const specialFlagDefaults = linkedReport
    ? {
        pregnancyStatus: asTriState(linkedReport.pregnancyStatus),
        alcoholUse: asTriState(linkedReport.alcoholUse),
        smoking: asTriState(linkedReport.smoking),
        caffeineUse: asTriState(linkedReport.caffeineUse),
        headache: asTriState(linkedReport.headache),
        insomnia: asTriState(linkedReport.insomnia),
        chestPain: asTriState(linkedReport.chestPain),
        dyspnea: asTriState(linkedReport.dyspnea),
        dizziness: asTriState(linkedReport.dizziness),
        pregnancyMonths: linkedReport.pregnancyMonths,
      }
    : undefined;
  let clinicalSituationDefaults: string[] = [];
  try {
    const parsed = JSON.parse(linkedReport?.specialSituations ?? "[]");
    if (Array.isArray(parsed)) {
      clinicalSituationDefaults = parsed.filter(
        (value): value is string => typeof value === "string",
      );
    }
  } catch {
    clinicalSituationDefaults = [];
  }
  const schedule = result.schedule;

  const chartPoints = result.measurements
    .filter((measurement) => measurement.valid)
    .map((measurement) => ({
      at: measurement.measuredAt,
      systolic: measurement.systolic,
      diastolic: measurement.diastolic,
      heartRate: measurement.heartRate,
    }));

  const displayAwake = sleepEnd || schedule?.awakeStart || sleepWindow?.end || "";
  const displayAsleep = sleepStart || schedule?.asleepStart || sleepWindow?.start || "";

  const formError =
    error === "situacoes-especiais"
      ? "Informe Sim, Não ou Não informado para todas as situações especiais."
      : error === "gestacao-meses"
        ? "Informe os meses de gestação."
        : error === "dados-incompletos"
          ? "Preencha a data do exame."
          : error === "paciente-ausente"
            ? "Paciente não vinculado à análise."
            : error === "laudo-existente"
              ? "Já existe um laudo deste paciente nesta data de exame."
              : null;

  return (
    <div className="max-w-7xl">
      {alreadyImported && linkedReport ? (
        <Link
          className="text-sm text-slate-600 underline"
          href={`/reports/${linkedReport.id}`}
        >
          Voltar à revisão do laudo
        </Link>
      ) : (
        <Link className="text-sm text-slate-600 underline" href="/reports/new">
          Voltar
        </Link>
      )}
      <h1 className="mt-2 text-2xl font-semibold">
        {alreadyImported ? "Conferência do exame" : "Análise do arquivo"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {alreadyImported
          ? "Altere medições, PA de consultório ou situações especiais e grave de novo no laudo."
          : "Confira os dados extraídos. Nada é gravado no laudo até você confirmar a importação."}
      </p>
      {reportLocked ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este laudo já foi aprovado. Os dados do exame não podem ser alterados.
        </p>
      ) : null}
      {formError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <ul className="space-y-1">
          <li>✓ Arquivo válido</li>
          <li>
            ✓ Equipamento reconhecido: {result.manufacturer} {result.deviceModel}
          </li>
          <li>✓ {formatInteger(result.rawRecords.length)} registros encontrados</li>
          <li>✓ {formatInteger(metrics.validMeasurements)} medições válidas</li>
          {metrics.invalidMeasurements > 0 ? (
            <li className="text-amber-700">
              ⚠ {formatInteger(metrics.invalidMeasurements)} medições inválidas (excluídas dos
              cálculos)
            </li>
          ) : null}
          {!sleepWindow ? (
            <li className="text-amber-700">⚠ Horário de sono não encontrado no arquivo.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Paciente</h2>
        <p className="mt-1 text-xs text-slate-500">
          Cadastrado automaticamente a partir do arquivo
          {linkedPatient ? (
            <>
              {" "}
              — vinculado a{" "}
              <Link className="underline" href={`/patients/${linkedPatient.id}`}>
                {linkedPatient.name}
              </Link>
            </>
          ) : null}
          .
        </p>
        {patientData ? (
          <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1">
            <dt className="text-slate-500">Nome</dt>
            <dd>{patientData.name ?? "—"}</dd>
            <dt className="text-slate-500">Nascimento</dt>
            <dd>{patientData.birthday ? formatDate(patientData.birthday) : "—"}</dd>
            <dt className="text-slate-500">Idade</dt>
            <dd>{patientData.age != null ? `${patientData.age} anos` : "—"}</dd>
            <dt className="text-slate-500">Altura</dt>
            <dd>{patientData.heightCm != null ? `${patientData.heightCm} cm` : "—"}</dd>
            <dt className="text-slate-500">Peso</dt>
            <dd>{patientData.weightKg != null ? `${patientData.weightKg} kg` : "—"}</dd>
            <dt className="text-slate-500">Medicações</dt>
            <dd className="whitespace-pre-wrap">{patientData.medications ?? "—"}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-amber-700">
            [PATIENTDATA] ausente ou incompleto neste arquivo.
          </p>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Período configurado no equipamento</h2>
        {schedule || sleepWindow ? (
          <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1">
            <dt className="text-slate-500">Vigília</dt>
            <dd>{schedule?.awakeStart ?? (displayAwake || "—")}</dd>
            <dt className="text-slate-500">Sono</dt>
            <dd>{schedule?.asleepStart ?? (displayAsleep || "—")}</dd>
            <dt className="text-slate-500">Intervalo vigília</dt>
            <dd>
              {schedule?.awakeMeasurementIntervalMinutes != null
                ? `${schedule.awakeMeasurementIntervalMinutes} min`
                : "—"}
            </dd>
            <dt className="text-slate-500">Intervalo sono</dt>
            <dd>
              {schedule?.asleepMeasurementIntervalMinutes != null
                ? `${schedule.asleepMeasurementIntervalMinutes} min`
                : "—"}
            </dd>
          </dl>
        ) : (
          <p className="mt-2 text-amber-700">
            O arquivo não informa o período configurado no equipamento.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Estes horários vêm da configuração do aparelho. Se o paciente relatou horários reais
          diferentes, altere abaixo antes de recalcular vigília e sono.
          {sleepSource ? ` Em uso: ${sleepSourceLabel(sleepSource)}.` : ""}
        </p>
        <form className="mt-3 flex flex-wrap items-end gap-3" method="get">
          <div className="w-40">
            <Field
              defaultValue={displayAsleep}
              label="Sono (início)"
              name="sleepStart"
              type="time"
            />
          </div>
          <div className="w-40">
            <Field
              defaultValue={displayAwake}
              label="Vigília (início)"
              name="sleepEnd"
              type="time"
            />
          </div>
          <button className="rounded-md border border-slate-300 px-4 py-2" type="submit">
            Recalcular
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Medições</h2>
        <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1">
          <dt className="text-slate-500">Total</dt>
          <dd>{formatInteger(metrics.totalMeasurements)}</dd>
          <dt className="text-slate-500">Válidas</dt>
          <dd>{formatInteger(metrics.validMeasurements)}</dd>
          <dt className="text-slate-500">Inválidas</dt>
          <dd>{formatInteger(metrics.invalidMeasurements)}</dd>
        </dl>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Arquivo de origem</h2>
        <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1">
          <dt className="text-slate-500">Nome original</dt>
          <dd>{sourceFile.originalFileName}</dd>
          <dt className="text-slate-500">Tamanho</dt>
          <dd>{formatFileSize(sourceFile.fileSize)}</dd>
          <dt className="text-slate-500">SHA-256</dt>
          <dd className="break-all font-mono text-xs">{sourceFile.fileHash}</dd>
          <dt className="text-slate-500">Codificação detectada</dt>
          <dd>{sourceFile.encoding}</dd>
          <dt className="text-slate-500">Formato detectado</dt>
          <dd>{sourceFile.detectedFormat}</dd>
          <dt className="text-slate-500">Versão do arquivo</dt>
          <dd>{sourceFile.detectedVersion ?? "não declarada"}</dd>
          <dt className="text-slate-500">Versão do parser</dt>
          <dd>{sourceFile.parserVersion}</dd>
          <dt className="text-slate-500">Confiança do parsing</dt>
          <dd>{CONFIDENCE_LABEL[sourceFile.parseConfidence] ?? sourceFile.parseConfidence}</dd>
          <dt className="text-slate-500">Configuração do aparelho</dt>
          <dd>
            {result.deviceSetupStartedAt
              ? formatDateTime(result.deviceSetupStartedAt)
              : "—"}
          </dd>
          <dt className="text-slate-500">Início das medições</dt>
          <dd>
            {result.measurementStartedAt
              ? formatDateTime(result.measurementStartedAt)
              : metrics.examStart
                ? formatDateTime(metrics.examStart)
                : "—"}
          </dd>
          <dt className="text-slate-500">Fim do exame</dt>
          <dd>{metrics.examEnd ? formatDateTime(metrics.examEnd) : "—"}</dd>
        </dl>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Resultados calculados</h2>
        <p className="mt-1 text-xs text-slate-500">
          Calculados em código a partir das {formatInteger(metrics.validMeasurements)} medições
          válidas. Nenhum valor passou por IA.
        </p>
        <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1">
          <dt className="text-slate-500">Medições válidas</dt>
          <dd>
            {formatInteger(metrics.validMeasurements)} de {formatInteger(metrics.totalMeasurements)}{" "}
            ({formatPercent(metrics.validMeasurementsPercentage)})
          </dd>
          <dt className="text-slate-500">Médias 24 horas</dt>
          <dd>{formatPressurePair(metrics.avg24hSystolic, metrics.avg24hDiastolic)}</dd>
          <dt className="text-slate-500">Vigília</dt>
          <dd>
            {metrics.awake
              ? `${formatPressurePair(metrics.awake.avgSystolic, metrics.awake.avgDiastolic)} (${formatInteger(metrics.awake.count)} medições)`
              : "aguardando janela de sono"}
          </dd>
          <dt className="text-slate-500">Sono</dt>
          <dd>
            {metrics.sleep
              ? `${formatPressurePair(metrics.sleep.avgSystolic, metrics.sleep.avgDiastolic)} (${formatInteger(metrics.sleep.count)} medições)`
              : "aguardando janela de sono"}
          </dd>
          <dt className="text-slate-500">Descenso sistólico</dt>
          <dd>{formatPercent(metrics.systolicNightDipping)}</dd>
          <dt className="text-slate-500">Descenso diastólico</dt>
          <dd>{formatPercent(metrics.diastolicNightDipping)}</dd>
          <dt className="text-slate-500">PAS mínima / máxima</dt>
          <dd>
            {formatInteger(metrics.minSystolic)} / {formatInteger(metrics.maxSystolic)} mmHg
          </dd>
          <dt className="text-slate-500">PAD mínima / máxima</dt>
          <dd>
            {formatInteger(metrics.minDiastolic)} / {formatInteger(metrics.maxDiastolic)} mmHg
          </dd>
          <dt className="text-slate-500">FC média (mín/máx)</dt>
          <dd>
            {formatNumber(metrics.avgHeartRate)} bpm ({formatInteger(metrics.minHeartRate)}–
            {formatInteger(metrics.maxHeartRate)})
          </dd>
          <dt className="text-slate-500">Maior PAS</dt>
          <dd>
            {metrics.peakSystolic
              ? `${formatInteger(metrics.peakSystolic.value)} mmHg em ${formatDateTime(metrics.peakSystolic.at)}`
              : "—"}
          </dd>
          <dt className="text-slate-500">Maior PAD</dt>
          <dd>
            {metrics.peakDiastolic
              ? `${formatInteger(metrics.peakDiastolic.value)} mmHg em ${formatDateTime(metrics.peakDiastolic.at)}`
              : "—"}
          </dd>
        </dl>
        {metrics.awake || metrics.sleep ? (
          <div className="mt-4">
            <h3 className="font-semibold">Cargas pressóricas</h3>
            <p className="text-xs text-slate-500">
              Percentual de medições acima dos limiares configurados (vigília{" "}
              {metrics.loadBasis?.awake.systolic}/{metrics.loadBasis?.awake.diastolic}, sono{" "}
              {metrics.loadBasis?.sleep.systolic}/{metrics.loadBasis?.sleep.diastolic} mmHg).
            </p>
            <dl className="mt-2 grid grid-cols-[220px_1fr] gap-y-1">
              <dt className="text-slate-500">Carga PAS vigília</dt>
              <dd>{formatPercent(metrics.awake?.systolicLoad)}</dd>
              <dt className="text-slate-500">Carga PAD vigília</dt>
              <dd>{formatPercent(metrics.awake?.diastolicLoad)}</dd>
              <dt className="text-slate-500">Carga PAS sono</dt>
              <dd>{formatPercent(metrics.sleep?.systolicLoad)}</dd>
              <dt className="text-slate-500">Carga PAD sono</dt>
              <dd>{formatPercent(metrics.sleep?.diastolicLoad)}</dd>
            </dl>
          </div>
        ) : null}
      </section>

      {chartPoints.length > 1 ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">Pressão ao longo do exame</h2>
          <div className="mt-3">
            <BpTimeChart
              limits={
                metrics.loadBasis
                  ? { awake: metrics.loadBasis.awake, sleep: metrics.loadBasis.sleep }
                  : null
              }
              points={chartPoints}
              sleepWindow={
                sleepWindow
                  ? { start: sleepWindow.start, end: sleepWindow.end }
                  : displayAsleep && displayAwake
                    ? { start: displayAsleep, end: displayAwake }
                    : null
              }
            />
          </div>
        </section>
      ) : null}

      {chartPoints.length > 0 ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <BpHistogramCharts points={chartPoints} />
        </section>
      ) : null}

      {chartPoints.length > 0 ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <BpPieCharts
            diastolicHigh={metrics.loadBasis?.awake.diastolic ?? 85}
            points={chartPoints}
            systolicHigh={metrics.loadBasis?.awake.systolic ?? 135}
          />
        </section>
      ) : null}

      <MeasurementObservationTable
        formId={confirmFormId}
        measurements={result.measurements}
        readOnly={reportLocked}
        sourceFileId={sourceFile.id}
      />

      {warnings.length > 0 ? (
        <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
          <h2 className="font-semibold">Avisos da análise</h2>
          <ul className="mt-3 space-y-2">
            {warnings.map((warning) => (
              <li key={warning.code}>
                <span className="font-mono text-xs">{warning.code}</span> — {warning.message}
                {warning.records.length > 0 ? (
                  <span className="block text-xs text-amber-800">
                    Registros: {warning.records.slice(0, 30).join(", ")}
                    {warning.records.length > 30 ? "…" : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.unknownFields.length > 0 || result.comments.length > 0 ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold">Conteúdo não interpretado</h2>
          <p className="mt-1 text-xs text-slate-500">
            Preservado do arquivo original e não utilizado em nenhum cálculo.
          </p>
          {result.unknownFields.length > 0 ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-50 p-3 text-xs">
              {result.unknownFields.join("\n")}
            </pre>
          ) : null}
          {result.comments.length > 0 ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-50 p-3 text-xs">
              {result.comments.join("\n")}
            </pre>
          ) : null}
        </section>
      ) : null}

      {!canImport ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          A estrutura deste arquivo não foi reconhecida com segurança suficiente. A importação está
          bloqueada para não gravar dados incertos no laudo. Use o AWP Inspector em
          desenvolvimento para investigar o formato.
        </p>
      ) : null}

      <form
        action={confirm}
        className="mt-4 space-y-6 rounded-lg border border-slate-200 bg-white p-5"
        id={confirmFormId}
      >
        <fieldset className="space-y-6" disabled={reportLocked}>
          <div>
            <h2 className="font-semibold">Dados do laudo</h2>
            <p className="mt-1 text-xs text-slate-500">
              Campos preenchidos a partir do arquivo quando disponíveis. Altere somente o que for
              diferente do relato clínico.
            </p>
          </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field
              defaultValue={linkedReport?.assistantDoctorName ?? ""}
              label="Médico assistente"
              name="assistantDoctorName"
              required
            />
          </div>
          <Field
            defaultValue={
              linkedReport
                ? toInputDate(linkedReport.examDate)
                : metrics.examStart
                  ? toInputDate(metrics.examStart)
                  : ""
            }
            label="Data do exame"
            name="examDate"
            required
            type="date"
          />
          <input name="sleepStart" type="hidden" value={displayAsleep} />
          <input name="sleepEnd" type="hidden" value={displayAwake} />
          <MedicationFields
            defaultMedications={
              linkedReport?.currentMedications || patientData?.medications || ""
            }
            defaultStatus={asTriState(linkedReport?.cvMedicationStatus ?? "")}
          />
          <Field
            defaultValue={linkedReport?.officeSystolicPressure ?? ""}
            label="PAS consultório"
            name="officeSystolicPressure"
            type="number"
          />
          <Field
            defaultValue={linkedReport?.officeDiastolicPressure ?? ""}
            label="PAD consultório"
            name="officeDiastolicPressure"
            type="number"
          />
          <Field
            defaultValue={linkedReport?.officeHeartRate ?? ""}
            label="FC consultório (bpm)"
            name="officeHeartRate"
            type="number"
          />
          <SpecialSituationFlags
            className="col-span-2"
            defaults={specialFlagDefaults}
          />
          <ClinicalSituationCheckboxes defaults={clinicalSituationDefaults} />
          <fieldset className="col-span-2 space-y-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">
              Gráficos no laudo
            </legend>
            <p className="text-xs text-slate-500">
              Escolha quais páginas de gráfico entram na impressão.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                defaultChecked={linkedReport?.includeTrendChart ?? true}
                name="includeTrendChart"
                type="checkbox"
              />
              Tendência (BP vs Tempo)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                defaultChecked={linkedReport?.includeHistogramChart ?? true}
                name="includeHistogramChart"
                type="checkbox"
              />
              Histograma
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                defaultChecked={linkedReport?.includePieChart ?? true}
                name="includePieChart"
                type="checkbox"
              />
              Gráfico de pizza
            </label>
          </fieldset>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-md bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={!canImport || reportLocked}
            type="submit"
          >
            {alreadyImported ? "Salvar alterações no laudo" : "Importar dados para o laudo"}
          </button>
          {alreadyImported && linkedReport ? (
            <Link className="text-sm text-slate-600 underline" href={`/reports/${linkedReport.id}`}>
              Voltar à revisão
            </Link>
          ) : (
            <Link className="text-sm text-slate-600 underline" href="/reports/new">
              Voltar
            </Link>
          )}
        </div>
        </fieldset>
      </form>

      {!alreadyImported ? (
        <form action={discard} className="mt-3">
          <button className="text-sm text-red-700 underline" type="submit">
            Cancelar e descartar esta análise
          </button>
        </form>
      ) : null}
    </div>
  );
}
