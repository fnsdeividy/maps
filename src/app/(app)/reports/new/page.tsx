import { prisma } from "@/lib/prisma";
import { AwpImportPanel } from "./AwpImportPanel";
import { ManualReportForm } from "./ManualReportForm";
import { NewReportModeSelector } from "./NewReportModeSelector";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const patients = await prisma.patient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Novo laudo</h1>
      <p className="mt-1 text-sm text-slate-500">
        Preencha os parâmetros manualmente ou importe o arquivo .AWP do CONTEC ABPM50. Na
        importação, os valores vêm do arquivo e passam por conferência antes de virarem laudo.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <NewReportModeSelector
        imported={<AwpImportPanel />}
        manual={<ManualReportForm patients={patients} />}
      />
    </div>
  );
}
