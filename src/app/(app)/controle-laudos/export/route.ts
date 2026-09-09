import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  formatPercentChange,
  parseControlReportFilters,
  toCsv,
  toExcelXmlWorkbook,
} from "@/domain/reports/controlReport";
import { getControlReport } from "@/services/reports/controlReport";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const filters = parseControlReportFilters(
    Object.fromEntries(url.searchParams.entries()),
  );
  const format = first(url.searchParams.get("format") ?? undefined) ?? "csv";
  const data = await getControlReport(filters);

  const headers = [
    "Código",
    "ID",
    "Data de criação",
    "Data de conclusão",
    "Status",
    "Tipo",
    "Setor",
    "Responsável",
    "Atraso",
  ];
  const rows = data.rows.map((row) => [
    row.code,
    row.id,
    row.createdAtLabel,
    row.completedAtLabel,
    row.statusLabel,
    row.sourceLabel,
    row.sector,
    row.assignee,
    row.overdue ? "Sim" : "Não",
  ]);

  const summaryHeaders = ["Indicador", "Valor"];
  const summaryRows = [
    ["Período", data.period.label],
    ["Total de laudos", String(data.metrics.total)],
    ["Total no período anterior", String(data.metrics.previousTotal)],
    [
      "Variação vs período anterior",
      data.metrics.totalChange == null
        ? "sem base"
        : formatPercentChange(data.metrics.totalChange),
    ],
    ["Rascunho / pendente", String(data.metrics.buckets.draft)],
    ["Em processamento", String(data.metrics.buckets.processing)],
    ["Concluído / aprovado", String(data.metrics.buckets.completed)],
    ["Com erro / rejeitado", String(data.metrics.buckets.returned)],
    ["Cancelado", String(data.metrics.buckets.cancelled)],
    [
      "Taxa de conclusão (%)",
      data.metrics.completionRate == null ? "—" : String(data.metrics.completionRate),
    ],
    [
      "Taxa de erro (%)",
      data.metrics.errorRate == null ? "—" : String(data.metrics.errorRate),
    ],
    [
      "Tempo médio de processamento (h)",
      data.metrics.averageProcessingHours == null
        ? "—"
        : String(data.metrics.averageProcessingHours),
    ],
    ["Laudos em atraso", String(data.metrics.overdueCount)],
  ];

  const stamp = `${data.period.fromKey}_${data.period.toKey}`;

  if (format === "xlsx" || format === "xls") {
    const workbook = toExcelXmlWorkbook([
      { name: "Indicadores", headers: summaryHeaders, rows: summaryRows },
      { name: "Laudos", headers, rows },
    ]);
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="controle-laudos-${stamp}.xls"`,
      },
    });
  }

  const csv = [
    toCsv(summaryHeaders, summaryRows).replace(/^\uFEFF/, ""),
    "",
    toCsv(headers, rows).replace(/^\uFEFF/, ""),
  ].join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="controle-laudos-${stamp}.csv"`,
    },
  });
}
