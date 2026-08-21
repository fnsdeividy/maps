import { notFound } from "next/navigation";
import { Field } from "@/components/Field";
import { prisma } from "@/lib/prisma";
import { toInputDate } from "@/lib/dates";
import { deletePatient, updatePatient } from "../actions";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const update = updatePatient.bind(null, id);
  const remove = deletePatient.bind(null, id);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Editar paciente</h1>
      <form action={update} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field defaultValue={patient.name} label="Nome" name="name" required />
        <Field
          defaultValue={toInputDate(patient.birthDate)}
          label="Data de nascimento"
          name="birthDate"
          required
          type="date"
        />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Sexo</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={patient.gender}
            name="gender"
            required
          >
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>
        <Field defaultValue={patient.document} label="Documento" name="document" />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Observações</span>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={patient.notes ?? ""}
            name="notes"
            rows={3}
          />
        </label>
        <div className="flex gap-3">
          <button className="rounded-md bg-teal-700 px-4 py-2 text-white" type="submit">
            Salvar
          </button>
        </div>
      </form>
      <form action={remove} className="mt-4">
        <button className="text-sm text-red-700" type="submit">
          Excluir paciente
        </button>
      </form>
    </div>
  );
}
