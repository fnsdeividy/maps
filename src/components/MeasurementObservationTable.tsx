"use client";

import { formatInteger } from "@/lib/numbers";
import { formatTime } from "@/lib/dates";

type MeasurementRow = {
  index: number;
  measuredAt: Date;
  systolic: number;
  diastolic: number;
  heartRate?: number;
  valid: boolean;
  invalidReason?: string;
  observation?: string;
};

export function MeasurementObservationTable({
  measurements,
  formId,
}: {
  measurements: MeasurementRow[];
  /** Associa os inputs ao formulário de confirmação mesmo fora dele. */
  formId: string;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold">
          Medições ({measurements.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Você pode registrar uma observação clínica em cada medição. Elas são
          gravadas no laudo na importação.
        </p>
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
            </tr>
          </thead>
          <tbody>
            {measurements.map((measurement) => (
              <tr className="border-t border-slate-100 align-top" key={measurement.index}>
                <td className="px-4 py-2 text-slate-500">{measurement.index}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatTime(measurement.measuredAt)}
                </td>
                <td className="px-4 py-2">
                  {measurement.valid ? formatInteger(measurement.systolic) : "---"}
                </td>
                <td className="px-4 py-2">
                  {measurement.valid ? formatInteger(measurement.diastolic) : "---"}
                </td>
                <td className="px-4 py-2">
                  {measurement.valid && measurement.heartRate != null
                    ? formatInteger(measurement.heartRate)
                    : "---"}
                </td>
                <td className="px-4 py-2">
                  {measurement.valid ? (
                    "Válida"
                  ) : (
                    <span className="text-amber-700">
                      Inválida
                      {measurement.invalidReason ? ` (${measurement.invalidReason})` : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    defaultValue={measurement.observation ?? ""}
                    form={formId}
                    maxLength={240}
                    name={`observation_${measurement.index}`}
                    placeholder="Ex.: esforço, sesta, sintoma…"
                    type="text"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
