"use client";

import { useState } from "react";
import { Field } from "@/components/Field";

type Patient = { id: string; name: string };

type PatientMode = "existing" | "new";

export type PatientPickerDefaults = {
  name?: string;
  birthDate?: string;
  gender?: "M" | "F" | "OTHER";
  document?: string;
};

export function PatientPicker({
  patients = [],
  defaults,
  preferredPatientId,
}: {
  patients?: Patient[];
  /** Pré-preenche o cadastro novo sem sobrescrever edição manual do usuário. */
  defaults?: PatientPickerDefaults;
  preferredPatientId?: string | null;
}) {
  const list = patients ?? [];
  const [mode, setMode] = useState<PatientMode>(list.length > 0 ? "existing" : "new");

  return (
    <div className="space-y-3">
      {list.length > 0 ? (
        <fieldset>
          <legend className="sr-only">Paciente</legend>
          <div className="flex flex-wrap gap-2 text-sm">
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 ${
                mode === "existing"
                  ? "border-teal-600 bg-teal-50 text-teal-900"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                checked={mode === "existing"}
                className="sr-only"
                name="patientMode"
                onChange={() => setMode("existing")}
                type="radio"
                value="existing"
              />
              Paciente cadastrado
            </label>
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 ${
                mode === "new"
                  ? "border-teal-600 bg-teal-50 text-teal-900"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                checked={mode === "new"}
                className="sr-only"
                name="patientMode"
                onChange={() => setMode("new")}
                type="radio"
                value="new"
              />
              Cadastrar agora
            </label>
          </div>
        </fieldset>
      ) : (
        <input name="patientMode" type="hidden" value="new" />
      )}

      {mode === "existing" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Paciente</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={preferredPatientId ?? list[0]?.id ?? ""}
            name="patientId"
            required
          >
            {list.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <Field
            defaultValue={defaults?.name}
            label="Nome completo"
            name="patientName"
            required
          />
          <Field
            defaultValue={defaults?.birthDate}
            label="Data de nascimento"
            name="patientBirthDate"
            required
            type="date"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Sexo</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              defaultValue={defaults?.gender ?? "F"}
              name="patientGender"
              required
            >
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="OTHER">Outro</option>
            </select>
          </label>
          <Field
            defaultValue={defaults?.document}
            label="Documento (opcional)"
            name="patientDocument"
          />
        </div>
      )}
    </div>
  );
}
