"use client";

export function PrintToolbar() {
  return (
    <div className="print:hidden sticky top-0 z-10 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Layout clínico Amacor — use imprimir do navegador (Ctrl/Cmd+P)
        </p>
        <button
          className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white"
          onClick={() => window.print()}
          type="button"
        >
          Imprimir
        </button>
      </div>
    </div>
  );
}
