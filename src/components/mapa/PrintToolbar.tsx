"use client";

type PrintToolbarProps = {
  /** Impressão de rascunho (não conta como laudo oficial). */
  draft?: boolean;
};

export function PrintToolbar({ draft = false }: PrintToolbarProps) {
  return (
    <div className="print:hidden sticky top-0 z-10 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {draft
            ? "Rascunho — a impressão sai marcada como não aprovada e não substitui o laudo oficial."
            : "Layout clínico Amacor — use imprimir do navegador (Ctrl/Cmd+P)"}
        </p>
        <button
          className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white"
          onClick={() => window.print()}
          type="button"
        >
          {draft ? "Imprimir rascunho" : "Imprimir"}
        </button>
      </div>
    </div>
  );
}
