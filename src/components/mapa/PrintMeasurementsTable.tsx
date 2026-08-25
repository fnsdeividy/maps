"use client";

import { useState, useTransition, type ReactNode } from "react";
import { formatDate, formatTime } from "@/lib/dates";
import { formatInteger } from "@/lib/numbers";
import { DiscardMeasurementDialog } from "@/components/DiscardMeasurementDialog";
import { setReportMeasurementDiscardedAction } from "@/app/(app)/reports/actions";
import {
  chunkRows,
  listPrintMeasurements,
  PRINT_MEASUREMENT_ROWS_PER_PAGE,
} from "@/components/mapa/printMeasurements";

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
  header,
}: {
  measurements: PrintMeasurementRow[];
  reportId?: string;
  editable?: boolean;
  header: ReactNode;
}) {
  const [pending, setPending] = useState<PrintMeasurementRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const canEdit = Boolean(editable && reportId);
  const listed = listPrintMeasurements(measurements);
  const discardedRows = canEdit
    ? measurements.filter((row) => row.discarded)
    : [];
  const omitted = measurements.length - listed.length;
  const pages = chunkRows(listed, PRINT_MEASUREMENT_ROWS_PER_PAGE);

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

  if (measurements.length === 0) return null;

  return (
    <>
      {pages.map((rows, pageIndex) => (
        <article
          className="print-page mx-auto mt-8 max-w-[210mm] bg-white p-6 print:mt-0 print:p-0"
          key={pageIndex}
        >
          {header}
          {canEdit && pageIndex === 0 ? (
            <p className="print:hidden mt-2 text-[10px] text-slate-600">
              Desconsiderar uma aferição recalcula médias, gráficos e a
              interpretação, sem alterar o status de aprovação.
            </p>
          ) : null}
          <table className="print-measurements-table mt-3 w-full border-collapse text-[9px]">
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="py-3 text-slate-600"
                    colSpan={canEdit ? 11 : 10}
                  >
                    Nenhuma aferição válida para listar.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <MeasurementRow
                    canEdit={canEdit}
                    isPending={isPending}
                    key={row.index}
                    onDiscard={() => setPending(row)}
                    onRestore={() => restore(row.index)}
                    row={row}
                  />
                ))
              )}
            </tbody>
          </table>
          {canEdit && discardedRows.length > 0 && pageIndex === 0 ? (
            <div className="print:hidden mt-4">
              <p className="text-[10px] font-semibold text-slate-700">
                Desconsideradas (não saem na impressão)
              </p>
              <table className="mt-1 w-full border-collapse text-[9px]">
                <tbody>
                  {discardedRows.map((row) => (
                    <MeasurementRow
                      canEdit={canEdit}
                      isPending={isPending}
                      key={row.index}
                      onDiscard={() => setPending(row)}
                      onRestore={() => restore(row.index)}
                      row={row}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="mt-2 text-[10px] text-slate-600">
            Total de aferições: {formatInteger(measurements.length)}
            {omitted > 0
              ? ` · ${formatInteger(omitted)} inválidas não listadas`
              : ""}
            {pages.length > 1
              ? ` · página ${pageIndex + 1} de ${pages.length}`
              : ""}
          </p>
          <p className="mt-3 text-center text-[10px] text-slate-600">
            Este relatório somente pode ser usado para referência clínica
          </p>
        </article>
      ))}
      {canEdit ? (
        <div className="print:hidden">
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
        </div>
      ) : null}
    </>
  );
}

function MeasurementRow({
  row,
  canEdit,
  isPending,
  onDiscard,
  onRestore,
}: {
  row: PrintMeasurementRow;
  canEdit: boolean;
  isPending: boolean;
  onDiscard: () => void;
  onRestore: () => void;
}) {
  const discarded = Boolean(row.discarded);
  const map =
    row.meanArterialPressure != null
      ? row.meanArterialPressure
      : Math.round((row.systolic + 2 * row.diastolic) / 3);
  const pp = row.systolic - row.diastolic;

  return (
    <tr className="border-b border-slate-200 align-top">
      <td className="py-0.5 pr-2">{row.index}</td>
      <td className="py-0.5 pr-2 whitespace-nowrap">{formatDate(row.at)}</td>
      <td className="py-0.5 pr-2 whitespace-nowrap">{formatTime(row.at)}</td>
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
        {row.valid && row.heartRate != null ? formatInteger(row.heartRate) : "—"}
      </td>
      <td className="py-0.5 pr-2 whitespace-nowrap">
        {discarded ? "Desconsiderada" : row.valid ? "OK" : "Inválida"}
      </td>
      <td className="py-0.5 whitespace-pre-wrap">{row.observation ?? ""}</td>
      {canEdit ? (
        <td className="print:hidden py-0.5 pl-2 whitespace-nowrap text-[10px]">
          {discarded ? (
            <button
              className="text-teal-700 underline disabled:opacity-50"
              disabled={isPending}
              onClick={onRestore}
              type="button"
            >
              Restaurar
            </button>
          ) : row.valid ? (
            <button
              className="text-rose-700 underline disabled:opacity-50"
              disabled={isPending}
              onClick={onDiscard}
              type="button"
            >
              Desconsiderar
            </button>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}
