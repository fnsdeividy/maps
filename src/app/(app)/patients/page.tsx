import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { patientRepository } from "@/repositories/patientRepository";

export default async function PatientsPage() {
  const patients = await patientRepository.list();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
        <Link
          className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white"
          href="/patients/new"
        >
          Novo paciente
        </Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Nascimento</th>
              <th className="px-4 py-3">Sexo</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{patient.name}</td>
                <td className="px-4 py-3">{formatDate(patient.birthDate)}</td>
                <td className="px-4 py-3">{patient.gender}</td>
                <td className="px-4 py-3">{patient.document ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link className="text-teal-700" href={`/patients/${patient.id}`}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {patients.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Nenhum paciente cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
