import { Field } from "@/components/Field";
import { PatientPicker } from "@/components/PatientPicker";
import { SpecialSituationFlags } from "@/components/SpecialSituationFlags";
import { createAndGenerateReport } from "../actions";

const specialOptions = [
  { value: "ORTHOSTATIC", label: "Redução pressórica ortostática" },
  { value: "NAP", label: "Redução pressórica associada à sesta" },
  { value: "POSTPRANDIAL", label: "Redução pressórica pós-prandial" },
  { value: "BISOPROLOL", label: "Uso de Bisoprolol" },
  { value: "OFFICE_HIGH_BP", label: "PA elevada no consultório" },
];

export function ManualReportForm({
  patients,
}: {
  patients: Array<{ id: string; name: string }>;
}) {
  return (
    <form
      action={createAndGenerateReport}
      className="space-y-8 rounded-lg border border-slate-200 bg-white p-6"
    >
      <section className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <PatientPicker patients={patients} />
        </div>
        <div className="col-span-2">
          <Field label="Médico assistente" name="assistantDoctorName" required />
        </div>
        <Field label="Data do exame" name="examDate" required type="date" />
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block text-slate-600">Medicações atuais</span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            name="currentMedications"
            placeholder="Ex.: Uso de Bisoprolol 2,5mg às 7 horas."
            rows={2}
          />
        </label>
      </section>

      <section>
        <h2 className="font-semibold">Consultório</h2>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Field label="PAS consultório" name="officeSystolicPressure" type="number" />
          <Field label="PAD consultório" name="officeDiastolicPressure" type="number" />
          <Field label="FC (bpm)" name="officeHeartRate" type="number" />
        </div>
      </section>

      <SpecialSituationFlags />

      <section>
        <h2 className="font-semibold">Outras situações clínicas (opcional)</h2>
        <div className="mt-3 space-y-2 text-sm">
          {specialOptions.map((option) => (
            <label className="flex gap-2" key={option.value}>
              <input name="specialSituations" type="checkbox" value={option.value} />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Medições (resumo)</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Total de medições" name="totalMeasurements" type="number" />
          <Field label="Medições válidas" name="validMeasurements" type="number" />
          <Field label="PAS 24h" name="avg24hSystolic" type="number" />
          <Field label="PAD 24h" name="avg24hDiastolic" type="number" />
          <Field label="PAS vigília" name="awakeSystolic" type="number" />
          <Field label="PAD vigília" name="awakeDiastolic" type="number" />
          <Field label="PAS sono" name="sleepSystolic" type="number" />
          <Field label="PAD sono" name="sleepDiastolic" type="number" />
          <Field label="Carga PAS vigília (%)" name="awakeSystolicLoad" type="number" />
          <Field label="Carga PAD vigília (%)" name="awakeDiastolicLoad" type="number" />
          <Field label="Carga PAS sono (%)" name="sleepSystolicLoad" type="number" />
          <Field label="Carga PAD sono (%)" name="sleepDiastolicLoad" type="number" />
          <Field label="Descenso PAS (%)" name="systolicNightDipping" type="number" />
          <Field label="Descenso PAD (%)" name="diastolicNightDipping" type="number" />
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Picos pressóricos (manual)</h2>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex gap-2"><input name="peakAwake" type="checkbox" /> Durante a vigília</label>
          <label className="flex gap-2"><input name="peakSleep" type="checkbox" /> Durante o sono</label>
          <label className="flex gap-2"><input name="peakMorning" type="checkbox" /> Pico matutino</label>
          <label className="flex gap-2"><input name="peakWithHeartRateIncrease" type="checkbox" /> Aumento concomitante da FC</label>
          <label className="flex gap-2"><input name="peakPhysicalEmotionalStress" type="checkbox" /> Estresse físico/emocional</label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-slate-600">Observação</span>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" name="peakPressureNotes" rows={2} />
        </label>
      </section>

      <button className="rounded-md bg-teal-700 px-4 py-2 text-white" type="submit">
        Processar e gerar laudo
      </button>
    </form>
  );
}
