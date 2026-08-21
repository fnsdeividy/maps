"use client";

import { useState, type ReactNode } from "react";

type Mode = "MANUAL" | "IMPORT";

const options: Array<{ value: Mode; label: string; hint: string }> = [
  {
    value: "MANUAL",
    label: "Preencher manualmente",
    hint: "Digitar as médias e cargas já calculadas.",
  },
  {
    value: "IMPORT",
    label: "Importar arquivo do aparelho",
    hint: "Ler o .AWP exportado pelo CONTEC ABPM50.",
  },
];

export function NewReportModeSelector({
  manual,
  imported,
}: {
  manual: ReactNode;
  imported: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("MANUAL");

  return (
    <div className="mt-6 space-y-6">
      <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Como deseja informar os dados?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <label
              className={`flex cursor-pointer gap-3 rounded-md border px-4 py-3 text-sm ${
                mode === option.value
                  ? "border-teal-600 bg-teal-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
              key={option.value}
            >
              <input
                checked={mode === option.value}
                className="mt-1"
                name="reportMode"
                onChange={() => setMode(option.value)}
                type="radio"
                value={option.value}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "MANUAL" ? manual : imported}
    </div>
  );
}
