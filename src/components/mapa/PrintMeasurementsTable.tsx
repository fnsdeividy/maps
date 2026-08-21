"use client";

import { useState, useTransition } from "react";
import { formatDate, formatTime } from "@/lib/dates";
import { formatInteger } from "@/lib/numbers";
import { DiscardMeasurementDialog } from "@/components/DiscardMeasurementDialog";
import { setReportMeasurementDiscardedAction } from "@/app/(app)/reports/actions";

export type PrintMeasurementRow = {
  index: number;
  at: Date;
  systolic: number;
  diastolic: number;
  meanArterialPressure?: number | null;
  heartRate?: number | null;
  valid: boolean;
  discarded?: boolean;
  observation?: string | null;
};

export function PrintMeasurementsTable({
  measurements,
  reportId,
  editable,
}: {
  measurements: PrintMeasurementRow[];
  reportId?: string;
  editable?: boolean;
}) {
  const [pending, setPending] = useState<PrintMeasurementRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const canEdit = Boolean(editable && reportId);

  function confirmDiscard() {
    if (!pending || !reportId) return;
    const index = pending.index;
    setPending(null);
    startTransition(() => {
      void setReportMeasurementDiscardedAction(reportId, index, true);
    });
  }

  function restore(index: number) {
    if (!reportId) return;
    startTransition(() => {
      void setReportMeasurementDiscardedAction(reportId, index, false);
    });
  }

  return (
    <>
      {canEdit ? (
        <p className="print:hidden mt-2 text-[10px] text-slate-600">
          Desconsiderar uma aferição recalcula médias, gráficos e a interpretação,
          sem alterar o status de aprovação.
        </p>
      ) : null}
      <table className="mt-3 w-full border-collapse text-[9px]">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">ID</th>
            <th className="py-1 pr-2">Data</th>
            <th className="py-1 pr-2">Horário</th>
            <th className="py-1 pr-2 text-right">SIS</th>
            <th className="py-1 pr-2 text-right">MAP</th>
            <th className="py-1 pr-2 text-right">DIA</th>
            <th className="py-1 pr-2 text-right">PP</th>
            <th className="py-1 pr-2 text-right">FC</th>
            <th className="py-1 pr-2">Estado</th>
            <th className="py-1">Comentário</th>
            {canEdit ? (
              <th className="print:hidden py-1 pl-2">Ação</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {measurements.map((row) => {
            const map =
              row.meanArterialPressure != null
                ? row.meanArterialPressure
                : Math.round((row.systolic + 2 * row.diastolic) / 3);
            const pp = row.systolic - row.diastolic;
            const discarded = Boolean(row.discarded);
            return (
              <tr
                className="border-b border-slate-200 align-top break-inside-avoid"
                key={row.index}
              >
                <td className="py-0.5 pr-2">{row.index}</td>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {formatDate(row.at)}
                </td>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {formatTime(row.at)}
                </td>
                <td className="py-0.5 pr-2 text-right">
                  {row.valid ? formatInteger(row.systolic) : "—"}
                </td>
                <td className="py-0.5 pr-2 text-right">
                  {row.valid ? formatInteger(map) : "—"}
                </td>
                <td className="py-0.5 pr-2 text-right">
                  {row.valid ? formatInteger(row.diastolic) : "—"}
                </td>
                <td className="py-0.5 pr-2 text-right">
                  {row.valid ? formatInteger(pp) : "—"}
                </td>
                <td className="py-0.5 pr-2 text-right">
                  {row.valid && row.heartRate != null
                    ? formatInteger(row.heartRate)
                    : "—"}
                </td>
                <td className="py-0.5 pr-2 whitespace-nowrap">
                  {discarded
                    ? "Desconsiderada"
                    : row.valid
                      ? "OK"
                      : "Inválida"}
                </td>
                <td className="py-0.5 whitespace-pre-wrap">
                  {row.observation ?? ""}
                </td>
                {canEdit ? (
                  <td className="print:hidden py-0.5 pl-2 whitespace-nowrap text-[10px]">
                    {discarded ? (
                      <button
                        className="text-teal-700 underline disabled:opacity-50"
                        disabled={isPending}
                        onClick={() => restore(row.index)}
                        type="button"
                      >
                        Restaurar
                      </button>
                    ) : row.valid ? (
                      <button
                        className="text-rose-700 underline disabled:opacity-50"
                        disabled={isPending}
                        onClick={() => setPending(row)}
                        type="button"
                      >
                        Desconsiderar
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {canEdit ? (
        <DiscardMeasurementDialog
          onCancel={() => setPending(null)}
          onConfirm={confirmDiscard}
          pending={
            pending
              ? {
                  index: pending.index,
                  measuredAt: pending.at,
                  systolic: pending.systolic,
                  diastolic: pending.diastolic,
                }
              : null
          }
        >
          {" "}
          Médias e interpretação são recalculadas em seguida.
        </DiscardMeasurementDialog>
      ) : null}
    </>
  );
}
