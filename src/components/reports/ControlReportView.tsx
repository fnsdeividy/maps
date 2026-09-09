import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import {
  CONTROL_SECTOR,
  CONTROL_STATUS_BUCKETS,
  OVERDUE_AFTER_HOURS,
  controlReportSearchParams,
  formatHours,
  formatPercentChange,
  type ControlReportFilters,
} from "@/domain/reports/controlReport";
import type { getControlReport } from "@/services/reports/controlReport";

type ControlReportData = Awaited<ReturnType<typeof getControlReport>>;

const FREQUENCY_LINKS: Array<[ControlReportFilters["frequency"], string]> = [
  ["daily", "Diário"],
  ["weekly", "Semanal"],
  ["monthly", "Mensal"],
];

function qs(filters: ControlReportFilters, overrides: Partial<ControlReportFilters> = {}) {
  return controlReportSearchParams({ ...filters, ...overrides });
}

export function ControlReportView({
  data,
  variant = "page",
}: {
  data: ControlReportData;
  variant?: "page" | "print";
}) {
  const { filters, period, metrics, rows, assignees } = data;
  const query = qs(filters);
  const isPrint = variant === "print";

  return (
    <div className={isPrint ? "text-black" : ""}>
      <div className={isPrint ? "mb-4" : "flex flex-wrap items-start justify-between gap-4"}>
        <div>
          <h1 className="text-2xl font-semibold">Relatório de controle de laudos</h1>
          <p className={`mt-1 text-sm ${isPrint ? "text-slate-700" : "text-slate-500"}`}>
            Período analisado: {period.label}
            {filters.dateField === "completedAt"
              ? " (por data de conclusão)"
              : " (por data de criação)"}
          </p>
        </div>
        {isPrint ? null : (
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              className="rounded-md border border-slate-200 bg-white px-3 py-2"
              href={`/controle-laudos/export?format=csv&${query}`}
            >
              CSV
            </Link>
            <Link
              className="rounded-md border border-slate-200 bg-white px-3 py-2"
              href={`/controle-laudos/export?format=xlsx&${query}`}
            >
              Excel
            </Link>
            <Link
              className="rounded-md bg-teal-700 px-3 py-2 text-white"
              href={`/controle-laudos/print?${query}`}
            >
              PDF / imprimir
            </Link>
          </div>
        )}
      </div>

      {isPrint ? null : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {FREQUENCY_LINKS.map(([value, label]) => (
              <Link
                className={`rounded-md px-3 py-1 ${
                  filters.frequency === value
                    ? "bg-teal-700 text-white"
                    : "border border-slate-200 bg-white"
                }`}
                href={`/controle-laudos?${qs(filters, {
                  frequency: value,
                  from: undefined,
                  to: undefined,
                })}`}
                key={value}
              >
                {label}
              </Link>
            ))}
          </div>

          <form
            className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-3 xl:grid-cols-6"
            method="get"
          >
            <input name="frequency" type="hidden" value="custom" />
            <label className="block">
              <span className="mb-1 block text-slate-600">Data início</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.frequency === "custom" ? (filters.from ?? "") : period.fromKey}
                name="from"
                type="date"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Data fim</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.frequency === "custom" ? (filters.to ?? "") : period.toKey}
                name="to"
                type="date"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Filtrar por</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.dateField}
                name="dateField"
              >
                <option value="createdAt">Data de criação</option>
                <option value="completedAt">Data de conclusão</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Status</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.status}
                name="status"
              >
                <option value="all">Todos</option>
                <option value="draft">Rascunho / pendente</option>
                <option value="processing">Em processamento</option>
                <option value="completed">Concluído / aprovado</option>
                <option value="returned">Com erro / rejeitado</option>
                <option value="cancelled">Cancelado</option>
                <option value="DRAFT">Somente rascunho</option>
                <option value="GENERATED">Somente gerado</option>
                <option value="PENDING_APPROVAL">Somente aguardando aprovação</option>
                <option value="CHANGES_REQUESTED">Somente com pendências</option>
                <option value="APPROVED">Somente aprovado</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Tipo de laudo</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.source}
                name="source"
              >
                <option value="all">Todos</option>
                <option value="FILE">Arquivo AWP</option>
                <option value="MANUAL">Manual</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Setor</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.sector}
                name="sector"
              >
                <option value="all">Todos</option>
                <option value={CONTROL_SECTOR}>{CONTROL_SECTOR}</option>
              </select>
            </label>
            <label className="block md:col-span-2 xl:col-span-2">
              <span className="mb-1 block text-slate-600">Responsável</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={filters.createdById}
                name="createdById"
              >
                <option value="all">Todos</option>
                {assignees.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                className="rounded-md bg-slate-900 px-4 py-2 text-white"
                type="submit"
              >
                Aplicar filtros
              </button>
            </div>
          </form>
        </>
      )}

      <div className={`mt-6 grid gap-4 ${isPrint ? "grid-cols-4" : "grid-cols-2 xl:grid-cols-4"}`}>
        <StatCard
          hint={`Período anterior: ${metrics.previousTotal} (${formatPercentChange(metrics.totalChange)})`}
          label="Laudos no período"
          value={metrics.total}
        />
        <StatCard
          hint="Aprovados / total do período"
          label="Taxa de conclusão"
          value={metrics.completionRate == null ? "—" : `${metrics.completionRate.toLocaleString("pt-BR")}%`}
        />
        <StatCard
          hint="Devolvidos com pendências / total"
          label="Taxa de erro"
          value={metrics.errorRate == null ? "—" : `${metrics.errorRate.toLocaleString("pt-BR")}%`}
        />
        <StatCard
          hint={`Não aprovados há mais de ${OVERDUE_AFTER_HOURS}h`}
          label="Laudos em atraso"
          value={metrics.overdueCount}
        />
        <StatCard
          hint="Da criação até a aprovação"
          label="Tempo médio de processamento"
          value={formatHours(metrics.averageProcessingHours)}
        />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Distribuição por status</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Quantidade</th>
              <th className="px-4 py-3">Correspondência no sistema</th>
            </tr>
          </thead>
          <tbody>
            {CONTROL_STATUS_BUCKETS.map((bucket) => (
              <tr key={bucket.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{bucket.label}</td>
                <td className="px-4 py-3 font-medium">{metrics.buckets[bucket.id]}</td>
                <td className="px-4 py-3 text-slate-500">{bucket.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Detalhamento por laudo</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Criação</th>
              <th className="px-4 py-3">Conclusão</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Setor</th>
              <th className="px-4 py-3">Responsável</th>
              {isPrint ? null : <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => (
              <tr key={report.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{report.code}</td>
                <td className="px-4 py-3">{report.createdAtLabel}</td>
                <td className="px-4 py-3">{report.completedAtLabel}</td>
                <td className="px-4 py-3">
                  {report.statusLabel}
                  {report.overdue ? (
                    <span className="ml-2 text-xs text-red-700">atraso</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{report.sourceLabel}</td>
                <td className="px-4 py-3">{report.sector}</td>
                <td className="px-4 py-3">{report.assignee}</td>
                {isPrint ? null : (
                  <td className="px-4 py-3 text-right">
                    <Link className="text-teal-700" href={`/reports/${report.id}`}>
                      Abrir
                    </Link>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={isPrint ? 7 : 8}>
                  Nenhum laudo neste período com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className={`mt-6 text-xs ${isPrint ? "text-slate-600" : "text-slate-500"}`}>
        A plataforma não possui departamentos múltiplos, status de erro técnico nem
        cancelamento formal. Cancelado corresponde à exclusão lógica; “com erro / rejeitado”
        corresponde a laudos devolvidos com pendências. O comparativo usa o período imediatamente
        anterior de mesma duração (no mensal, o mês civil anterior).
      </p>
    </div>
  );
}
