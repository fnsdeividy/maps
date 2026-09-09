import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/dates";
import { getDashboardData } from "@/services/reports/dashboard";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Visão geral do serviço interno de laudos.
          </p>
        </div>
        <Link
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-teal-800"
          href="/controle-laudos"
        >
          Controle de laudos
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total de laudos" value={data.totalReports} />
        <StatCard label="Laudos no mês" value={data.monthReports} />
        <StatCard label="Rascunhos" value={data.drafts} />
        <StatCard label="Aprovados" value={data.approved} />
        <StatCard label="Pacientes" value={data.patients} />
        <StatCard label="Tokens no mês" value={data.monthTokens} />
        <StatCard label="Custo estimado no mês" value={formatCurrency(data.monthCost)} />
        <StatCard
          label="Parâmetros clínicos pendentes"
          value={data.pendingConfig}
        />
      </div>
      <h2 className="mt-10 text-lg font-semibold">Últimos laudos</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.recentReports.map((report) => (
              <tr key={report.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{report.patient.name}</td>
                <td className="px-4 py-3">{formatDateTime(report.createdAt)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={report.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link className="text-teal-700" href={`/reports/${report.id}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {data.recentReports.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  Nenhum laudo ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
