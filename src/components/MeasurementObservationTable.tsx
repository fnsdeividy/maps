"use client";

import { useState, useTransition } from "react";
import { formatInteger } from "@/lib/numbers";
import { formatTime } from "@/lib/dates";
import { setMeasurementDiscardedAction } from "@/app/(app)/reports/import/actions";
import { DiscardMeasurementDialog } from "@/components/DiscardMeasurementDialog";
import { isWithinSleepWindow } from "@/domain/mapa/services/MapaMetricsCalculator";

type MeasurementRow = {
  index: number;
  measuredAt: Date;
  systolic: number;
  diastolic: number;
  heartRate?: number;
  valid: boolean;
  invalidReason?: string;
  observation?: string;
  discarded?: boolean;
};

export function MeasurementObservationTable({
  measurements,
  formId,
  sourceFileId,
  sleepWindow = null,
  readOnly = false,
}: {
  measurements: MeasurementRow[];
  /** Associa os inputs ao formulário de confirmação mesmo fora dele. */
  formId: string;
  sourceFileId: string;
  sleepWindow?: { start: string; end: string } | null;
  readOnly?: boolean;
}) {
  const [pending, setPending] = useState<MeasurementRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDiscard() {
    if (!pending) return;
    const index = pending.index;
    setPending(null);
    startTransition(() => {
      void setMeasurementDiscardedAction(sourceFileId, index, true);
    });
  }

  function restore(index: number) {
    startTransition(() => {
      void setMeasurementDiscardedAction(sourceFileId, index, false);
    });
  }

  const listed = measurements.filter(
    (measurement) => measurement.valid || measurement.discarded,
  );

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold">
          Medições ({listed.length} de {measurements.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Você pode registrar uma observação clínica em cada medição ou
          desconsiderar um valor. Medições desconsideradas não entram nas médias
          nem nos gráficos do laudo.
        </p>
        {sleepWindow ? (
          <p className="mt-1 text-xs font-medium text-slate-600">
            Linhas em cinza escuro indicam o período de sono (
            {sleepWindow.start}–{sleepWindow.end}).
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Horário</th>
              <th className="px-4 py-2">PAS</th>
              <th className="px-4 py-2">PAD</th>
              <th className="px-4 py-2">FC</th>
              <th className="px-4 py-2">Status</th>
              <th className="min-w-[220px] px-4 py-2">Observação</th>
              <th className="px-4 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {listed.map((measurement) => {
              const discarded = Boolean(measurement.discarded);
              const usable = measurement.valid && !discarded;
              const asleep =
                sleepWindow &&
                isWithinSleepWindow(measurement.measuredAt, sleepWindow) ===
                  true;
              return (
                <tr
                  className={`border-t align-top ${
                    asleep
                      ? "border-slate-600 bg-slate-700 text-white"
                      : discarded
                        ? "border-slate-100 bg-slate-50 text-slate-500"
                        : "border-slate-100"
                  }`}
                  key={measurement.index}
                >
                  <td
                    className={`px-4 py-2 ${
                      asleep ? "text-slate-200" : "text-slate-500"
                    }`}
                  >
                    {measurement.index}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatTime(measurement.measuredAt)}
                  </td>
                  <td className="px-4 py-2">
                    {usable ? formatInteger(measurement.systolic) : "---"}
                  </td>
                  <td className="px-4 py-2">
                    {usable ? formatInteger(measurement.diastolic) : "---"}
                  </td>
                  <td className="px-4 py-2">
                    {usable && measurement.heartRate != null
                      ? formatInteger(measurement.heartRate)
                      : "---"}
                  </td>
                  <td className="px-4 py-2">
                    {discarded ? (
                      <span
                        className={asleep ? "text-rose-200" : "text-rose-700"}
                      >
                        Desconsiderada
                      </span>
                    ) : measurement.valid ? (
                      "Válida"
                    ) : (
                      <span
                        className={
                          asleep ? "text-amber-200" : "text-amber-700"
                        }
                      >
                        Inválida
                        {measurement.invalidReason
                          ? ` (${measurement.invalidReason})`
                          : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {discarded ? (
                      <input
                        form={formId}
                        name={`discarded_${measurement.index}`}
                        type="hidden"
                        value="1"
                      />
                    ) : null}
                    <input
                      className={`w-full rounded-md border px-2 py-1.5 text-sm ${
                        asleep
                          ? "border-slate-500 bg-slate-600 text-white placeholder:text-slate-300"
                          : "border-slate-300 bg-white"
                      }`}
                      defaultValue={measurement.observation ?? ""}
                      form={formId}
                      maxLength={240}
                      name={`observation_${measurement.index}`}
                      placeholder="Ex.: esforço, sesta, sintoma…"
                      readOnly={readOnly}
                      type="text"
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {readOnly ? null : discarded ? (
                      <button
                        className={`hover:underline disabled:opacity-50 ${
                          asleep ? "text-teal-200" : "text-teal-700"
                        }`}
                        disabled={isPending}
                        onClick={() => restore(measurement.index)}
                        type="button"
                      >
                        Restaurar
                      </button>
                    ) : measurement.valid ? (
                      <button
                        className={`hover:underline disabled:opacity-50 ${
                          asleep ? "text-rose-200" : "text-rose-700"
                        }`}
                        disabled={isPending}
                        onClick={() => setPending(measurement)}
                        type="button"
                      >
                        Desconsiderar
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DiscardMeasurementDialog
        onCancel={() => setPending(null)}
        onConfirm={confirmDiscard}
        pending={pending}
      >
        {" "}
        Esta ação pode ser desfeita antes de gravar no laudo.
      </DiscardMeasurementDialog>
    </section>
  );
}
