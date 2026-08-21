import { Field } from "@/components/Field";
import { createPatient } from "../actions";

export default function NewPatientPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Novo paciente</h1>
      <form action={createPatient} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field label="Nome" name="name" required />
        <Field label="Data de nascimento" name="birthDate" required type="date" />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Sexo</span>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2" name="gender" required>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>
        <Field label="Documento" name="document" />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Observações</span>
          <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" name="notes" rows={3} />
        </label>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-white" type="submit">
          Salvar
        </button>
      </form>
    </div>
  );
}
