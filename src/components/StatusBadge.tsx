const labels: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerado",
  PENDING_APPROVAL: "Aguardando aprovação",
  CHANGES_REQUESTED: "Com pendências",
  APPROVED: "Aprovado",
};

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "PENDING_APPROVAL"
        ? "bg-sky-100 text-sky-800"
        : status === "CHANGES_REQUESTED"
          ? "bg-red-100 text-red-800"
          : status === "GENERATED"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {labels[status] ?? status}
    </span>
  );
}
