"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { formatInteger } from "@/lib/numbers";
import { formatTime } from "@/lib/dates";

export type DiscardableMeasurement = {
  index: number;
  measuredAt: Date;
  systolic: number;
  diastolic: number;
};

export function DiscardMeasurementDialog({
  pending,
  onCancel,
  onConfirm,
  children,
}: {
  pending: DiscardableMeasurement | null;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending) dialog.showModal();
    else dialog.close();
  }, [pending]);

  return (
    <dialog
      className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg backdrop:bg-black/40"
      onClose={onCancel}
      ref={dialogRef}
    >
      <h3 className="text-base font-semibold">Desconsiderar medição?</h3>
      {pending ? (
        <p className="mt-2 text-sm text-slate-600">
          A aferição #{pending.index} às {formatTime(pending.measuredAt)} (
          {formatInteger(pending.systolic)}/{formatInteger(pending.diastolic)} mmHg)
          não entra nas médias, cargas nem gráficos do laudo.
          {children}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-md bg-rose-700 px-4 py-2 text-sm text-white"
          onClick={onConfirm}
          type="button"
        >
          Sim, desconsiderar
        </button>
      </div>
    </dialog>
  );
}
