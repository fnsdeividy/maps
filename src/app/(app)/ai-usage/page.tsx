import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { formatCurrency, formatDateTime } from "@/lib/dates";
import { getAiUsageSummary, rangeToDates, type UsageRange } from "@/services/ai/usage";

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = (params.range as UsageRange) || "30d";
  const { start, end } = rangeToDates(range, params.from, params.to);
  const data = await getAiUsageSummary(start, end);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Consumo de IA</h1>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {[
          ["today", "Hoje"],
          ["7d", "7 dias"],
          ["30d", "30 dias"],
        ].map(([value, label]) => (
          <Link
            className={`rounded-md px-3 py-1 ${range === value ? "bg-teal-700 text-white" : "bg-white border border-slate-200"}`}
            href={`/ai-usage?range=${value}`}
            key={value}
          >
            {label}
          </Link>
        ))}
      </div>
      <form className="mt-4 flex items-end gap-3 text-sm" method="get">
        <input name="range" type="hidden" value="custom" />
        <label>
          De
          <input className="ml-2 rounded border border-slate-300 px-2 py-1" name="from" type="date" />
        </label>
        <label>
          Até
          <input className="ml-2 rounded border border-slate-300 px-2 py-1" name="to" type="date" />
        </label>
        <button className="rounded-md bg-slate-900 px-3 py-1 text-white" type="submit">
          Período personalizado
        </button>
      </form>
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard label="Tokens no período" value={data.totalTokens} />
        <StatCard label="Tokens de entrada" value={data.inputTokens} />
        <StatCard label="Tokens de saída" value={data.outputTokens} />
        <StatCard label="Custo estimado" value={formatCurrency(data.estimatedCost)} />
        <StatCard label="Laudos com IA" value={data.reportsWithAi} />
        <StatCard label="Custo médio por laudo" value={formatCurrency(data.averageCost)} />
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Laudo</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Input</th>
              <th className="px-4 py-3">Output</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Custo</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
                <td className="px-4 py-3">{row.report.patient.name}</td>
                <td className="px-4 py-3">
                  <Link className="text-teal-700" href={`/reports/${row.reportId}`}>
                    abrir
                  </Link>
                </td>
                <td className="px-4 py-3">{row.model}</td>
                <td className="px-4 py-3">{row.inputTokens}</td>
                <td className="px-4 py-3">{row.outputTokens}</td>
                <td className="px-4 py-3">{row.totalTokens}</td>
                <td className="px-4 py-3">{formatCurrency(row.estimatedTotalCost)}</td>
              </tr>
            ))}
            {data.rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  Nenhuma chamada de IA neste período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
