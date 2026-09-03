"use client";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white"
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </button>
  );
}
