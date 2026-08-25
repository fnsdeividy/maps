"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import type { MapaThresholds } from "@/domain/mapa/config/thresholds";
import { saveClinicSettingsAction, type SettingsState } from "./actions";

function OptionalSection({
  title,
  description,
  enabledName,
  defaultEnabled,
  children,
}: {
  title: string;
  description: string;
  enabledName: string;
  defaultEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <label className="flex items-start gap-3">
        <input
          className="mt-1"
          defaultChecked={defaultEnabled}
          name={enabledName}
          type="checkbox"
        />
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="mt-1 block text-sm text-slate-500">{description}</span>
        </span>
      </label>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</div>
    </section>
  );
}

export function SettingsForm({
  thresholds,
  guidelineFooter,
}: {
  thresholds: MapaThresholds;
  guidelineFooter: string;
}) {
  const [state, save, pending] = useActionState<SettingsState, FormData>(
    saveClinicSettingsAction,
    {},
  );

  return (
    <form action={save} className="mt-6 space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Limiares de pressão arterial</h2>
        <p className="mt-1 text-sm text-slate-500">
          Valores usados para classificar médias de PAS/PAD em 24 horas, vigília e sono.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-700">24 horas</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <Field
                defaultValue={thresholds.full24Hours.systolic}
                label="PAS (mmHg)"
                name="full24hSystolic"
                required
                type="number"
              />
              <Field
                defaultValue={thresholds.full24Hours.diastolic}
                label="PAD (mmHg)"
                name="full24hDiastolic"
                required
                type="number"
              />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700">Vigília</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <Field
                defaultValue={thresholds.awake.systolic}
                label="PAS (mmHg)"
                name="awakeSystolic"
                required
                type="number"
              />
              <Field
                defaultValue={thresholds.awake.diastolic}
                label="PAD (mmHg)"
                name="awakeDiastolic"
                required
                type="number"
              />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700">Sono</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <Field
                defaultValue={thresholds.sleep.systolic}
                label="PAS (mmHg)"
                name="sleepSystolic"
                required
                type="number"
              />
              <Field
                defaultValue={thresholds.sleep.diastolic}
                label="PAD (mmHg)"
                name="sleepDiastolic"
                required
                type="number"
              />
            </div>
          </div>
        </div>
      </section>

      <OptionalSection
        defaultEnabled={thresholds.officeThresholds != null}
        description="Compara pressão de consultório com as médias do MAPA."
        enabledName="officeEnabled"
        title="Pressão de consultório"
      >
        <Field
          defaultValue={thresholds.officeThresholds?.systolic ?? 140}
          label="PAS consultório"
          name="officeSystolic"
          type="number"
        />
        <Field
          defaultValue={thresholds.officeThresholds?.diastolic ?? 90}
          label="PAD consultório"
          name="officeDiastolic"
          type="number"
        />
      </OptionalSection>

      <OptionalSection
        defaultEnabled={thresholds.significantlyElevatedThresholds != null}
        description="Separa pressão elevada de significativamente elevada nas médias."
        enabledName="significantlyElevatedEnabled"
        title="Pressão significativamente elevada"
      >
        <Field
          defaultValue={thresholds.significantlyElevatedThresholds?.systolic ?? 160}
          label="PAS"
          name="significantlyElevatedSystolic"
          type="number"
        />
        <Field
          defaultValue={thresholds.significantlyElevatedThresholds?.diastolic ?? 100}
          label="PAD"
          name="significantlyElevatedDiastolic"
          type="number"
        />
      </OptionalSection>

      <OptionalSection
        defaultEnabled={thresholds.pressureLoadThresholds != null}
        description="Carga elevada se o percentual de medições acima do limiar for ≥ 40% na vigília ou ≥ 50% no sono."
        enabledName="pressureLoadEnabled"
        title="Cargas pressóricas"
      >
        <Field
          defaultValue={
            thresholds.pressureLoadThresholds?.awakeElevatedPercent ?? 40
          }
          label="Vigília elevada a partir de (%)"
          name="pressureLoadAwakeElevatedPercent"
          type="number"
        />
        <Field
          defaultValue={
            thresholds.pressureLoadThresholds?.sleepElevatedPercent ?? 50
          }
          label="Sono elevada a partir de (%)"
          name="pressureLoadSleepElevatedPercent"
          type="number"
        />
      </OptionalSection>

      <OptionalSection
        defaultEnabled={thresholds.nightDippingThresholds != null}
        description="Limites percentuais para classificar descenso noturno."
        enabledName="nightDippingEnabled"
        title="Descenso pressórico noturno"
      >
        <Field
          defaultValue={thresholds.nightDippingThresholds?.absentMax ?? 10}
          label="Ausente até (%)"
          name="nightDippingAbsentMax"
          type="number"
        />
        <Field
          defaultValue={thresholds.nightDippingThresholds?.attenuatedMax ?? 20}
          label="Atenuado até (%)"
          name="nightDippingAttenuatedMax"
          type="number"
        />
        <Field
          defaultValue={thresholds.nightDippingThresholds?.normalMax ?? 20}
          label="Normal até (%)"
          name="nightDippingNormalMax"
          type="number"
        />
      </OptionalSection>

      <OptionalSection
        defaultEnabled={thresholds.technicalQualityThresholds != null}
        description="Percentual mínimo de medições válidas para considerar o exame tecnicamente adequado."
        enabledName="technicalQualityEnabled"
        title="Qualidade técnica"
      >
        <Field
          defaultValue={thresholds.technicalQualityThresholds?.minValidPercentage ?? 80}
          label="Mínimo de medições válidas (%)"
          name="technicalQualityMinValidPercent"
          type="number"
        />
      </OptionalSection>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Rodapé da diretriz</h2>
        <p className="mt-1 text-sm text-slate-500">
          Texto incluído nas considerações gerais do laudo quando ainda não estiver presente.
        </p>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-600">Texto</span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={guidelineFooter}
            name="guidelineFooter"
            required
            rows={3}
          />
        </label>
      </section>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          Configurações salvas. Novos laudos usarão estes parâmetros.
        </p>
      ) : null}

      <button
        className="rounded-md bg-teal-700 px-4 py-2 text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando..." : "Salvar configurações"}
      </button>
    </form>
  );
}
