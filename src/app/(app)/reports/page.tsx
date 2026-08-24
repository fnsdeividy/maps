import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { reportRepository } from "@/repositories/reportRepository";
import { isApprover, requireUser } from "@/lib/authz";
import { deleteReportAction } from "./actions";
import { DeleteReportButton } from "./DeleteReportButton";

export default async function ReportsPage() {
  const [reports, user] = await Promise.all([
    reportRepository.list(),
    requireUser(),
  ]);
  const canDelete = isApprover(user.role);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Laudos</h1>
        <Link className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white" href="/reports/new">
          Novo laudo
        </Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Exame</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              return (
                <tr key={report.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{report.patient.name}</td>
                  <td className="px-4 py-3">{formatDate(report.examDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-4 py-3">{report.source}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link className="text-teal-700" href={`/reports/${report.id}`}>
                        Revisar
                      </Link>
                      {canDelete ? (
                        <DeleteReportButton
                          action={deleteReportAction.bind(null, report.id)}
                          patientName={report.patient.name}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Nenhum laudo gerado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
