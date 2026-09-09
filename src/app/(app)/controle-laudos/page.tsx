import { ControlReportView } from "@/components/reports/ControlReportView";
import { parseControlReportFilters } from "@/domain/reports/controlReport";
import { requireUser } from "@/lib/authz";
import { getControlReport } from "@/services/reports/controlReport";

export const dynamic = "force-dynamic";

export default async function ControlReportPage({
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

  return <ControlReportView data={data} />;
}
