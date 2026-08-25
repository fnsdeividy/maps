"use client";

import { useState } from "react";
import { Field } from "@/components/Field";
import {
  SPECIAL_FLAG_FIELDS,
  type TriStateFlag,
} from "@/domain/mapa/specialFlags";

const OPTIONS: Array<{ value: TriStateFlag; label: string }> = [
  { value: "YES", label: "Sim" },
  { value: "NO", label: "Não" },
  { value: "UNKNOWN", label: "Não informado" },
];

export function SpecialSituationFlags({
  className,
  defaults,
}: {
  className?: string;
  defaults?: Partial<
    Record<(typeof SPECIAL_FLAG_FIELDS)[number]["name"], TriStateFlag>
  > & { pregnancyMonths?: number | null };
}) {
  const [pregnancyStatus, setPregnancyStatus] = useState<TriStateFlag | "">(
    defaults?.pregnancyStatus ?? "",
  );

  return (
    <fieldset className={className}>
      <legend className="text-sm font-semibold text-slate-800">
        Situações especiais <span className="font-normal text-red-600">*</span>
      </legend>
      <p className="mt-1 text-xs text-slate-500">
        Obrigatório informar Sim, Não ou Não informado para cada item,
        incluindo os sintomas.
      </p>
      <div className="mt-3 space-y-4">
        {SPECIAL_FLAG_FIELDS.map((field, index) => {
          const isPregnancy = field.name === "pregnancyStatus";
          const showSymptomHeading =
            field.group === "symptom" &&
            SPECIAL_FLAG_FIELDS[index - 1]?.group !== "symptom";
          return (
            <div key={field.name}>
              {showSymptomHeading ? (
                <p className="mb-3 mt-2 text-sm font-semibold text-slate-800">
                  Sintomas
                </p>
              ) : null}
              <p className="mb-1.5 text-sm font-medium text-slate-700">{field.label}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {OPTIONS.map((option) => (
                  <label className="inline-flex items-center gap-1.5" key={option.value}>
                    <input
                      checked={
                        isPregnancy ? pregnancyStatus === option.value : undefined
                      }
                      defaultChecked={
                        !isPregnancy
                          ? defaults?.[field.name] === option.value
                          : undefined
                      }
                      name={field.name}
                      onChange={
                        isPregnancy
                          ? () => setPregnancyStatus(option.value)
                          : undefined
                      }
                      required
                      type="radio"
                      value={option.value}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {isPregnancy && pregnancyStatus === "YES" ? (
                <div className="mt-2 max-w-xs">
                  <Field
                    defaultValue={defaults?.pregnancyMonths ?? ""}
                    label="Meses de gestação"
                    name="pregnancyMonths"
                    required
                    type="number"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
