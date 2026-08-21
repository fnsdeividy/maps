"use client";

type PrintToolbarProps = {
  /** Pré-visualização antes da aprovação (sem contar como impressão). */
  preview?: boolean;
};

export function PrintToolbar({ preview = false }: PrintToolbarProps) {
  return (
    <div className="print:hidden sticky top-0 z-10 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {preview
            ? "Pré-visualização para aprovação — todos os gráficos estão visíveis."
            : "Layout clínico Amacor — use imprimir do navegador (Ctrl/Cmd+P)"}
        </p>
        {!preview ? (
          <button
            className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white"
            onClick={() => window.print()}
            type="button"
          >
            Imprimir
          </button>
        ) : (
          <span className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500">
            Somente visualização
          </span>
        )}
      </div>
    </div>
  );
}
