import { ControlReportView } from "@/components/reports/ControlReportView";
import { PrintButton } from "@/components/PrintButton";
import { parseControlReportFilters } from "@/domain/reports/controlReport";
import { requireUser } from "@/lib/authz";
import { getControlReport } from "@/services/reports/controlReport";

export const dynamic = "force-dynamic";

export default async function ControlReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;
  const filters = parseControlReportFilters(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    ),
  );
  const data = await getControlReport(filters);

  return (
    <div className="print:p-0">
      <div className="print:hidden mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Use imprimir do navegador (Ctrl/Cmd+P) e escolha “Salvar como PDF”.
        </p>
        <PrintButton />
      </div>
      <ControlReportView data={data} variant="print" />
    </div>
  );
}
