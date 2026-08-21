import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { mapAwpGenderCode } from "@/domain/mapa/import/awp/patientData";
import type { AwpPatientData } from "@/domain/mapa/import/awp/types";
import { patientSchema } from "@/lib/validation";

export class PatientResolutionError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
    this.name = "PatientResolutionError";
  }
}

/** Usa paciente existente ou cria um novo a partir dos campos do formulário. */
export async function resolvePatientFromForm(formData: FormData): Promise<string> {
  const mode = String(formData.get("patientMode") ?? "existing");

  if (mode === "new") {
    const parsed = patientSchema.safeParse({
      name: formData.get("patientName"),
      birthDate: formData.get("patientBirthDate"),
      gender: formData.get("patientGender"),
      document: String(formData.get("patientDocument") ?? "") || undefined,
    });

    if (!parsed.success) {
      throw new PatientResolutionError(
        "Informe nome, data de nascimento e sexo para cadastrar o paciente.",
      );
    }

    const patient = await prisma.patient.create({
      data: {
        name: parsed.data.name,
        birthDate: new Date(parsed.data.birthDate),
        gender: parsed.data.gender,
        document: parsed.data.document,
      },
    });

    revalidatePath("/patients");
    revalidatePath("/reports/new");

    return patient.id;
  }

  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) {
    throw new PatientResolutionError("Selecione o paciente do exame.");
  }

  return patientId;
}

async function ensureGender(
  patientId: string,
  currentGender: string,
  mapped: "M" | "F" | "OTHER",
) {
  if (mapped === "OTHER" || currentGender === mapped) return;
  if (currentGender !== "OTHER") return;

  await prisma.patient.update({
    where: { id: patientId },
    data: { gender: mapped },
  });
  revalidatePath("/patients");
}

/**
 * Cadastra (ou reutiliza) o paciente a partir do [PATIENTDATA] do arquivo AWP.
 * Gender CONTEC: 0 = masculino, 1 = feminino.
 */
export async function resolvePatientFromAwpData(
  patientData: AwpPatientData | undefined,
): Promise<string> {
  const name = patientData?.name?.trim();
  const birthday = patientData?.birthday;

  if (!name || !birthday || Number.isNaN(birthday.getTime())) {
    throw new PatientResolutionError(
      "O arquivo não contém nome e data de nascimento em [PATIENTDATA]. Não foi possível cadastrar o paciente automaticamente.",
    );
  }

  const document = patientData.patientId?.trim() || undefined;
  const gender = mapAwpGenderCode(patientData.genderCode);

  if (document) {
    const byDocument = await prisma.patient.findFirst({
      where: { document },
      select: { id: true, gender: true },
    });
    if (byDocument) {
      await ensureGender(byDocument.id, byDocument.gender, gender);
      return byDocument.id;
    }
  }

  const dayStart = new Date(
    birthday.getFullYear(),
    birthday.getMonth(),
    birthday.getDate(),
  );
  const dayEnd = new Date(
    birthday.getFullYear(),
    birthday.getMonth(),
    birthday.getDate() + 1,
  );

  const byNameAndBirth = await prisma.patient.findFirst({
    where: {
      name,
      birthDate: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, gender: true },
  });
  if (byNameAndBirth) {
    await ensureGender(byNameAndBirth.id, byNameAndBirth.gender, gender);
    return byNameAndBirth.id;
  }

  const notesParts = [
    patientData.heightCm != null ? `Altura: ${patientData.heightCm} cm` : null,
    patientData.weightKg != null ? `Peso: ${patientData.weightKg} kg` : null,
    patientData.age != null ? `Idade no exame: ${patientData.age}` : null,
  ].filter(Boolean);

  const patient = await prisma.patient.create({
    data: {
      name,
      birthDate: dayStart,
      gender,
      document,
      notes: notesParts.length > 0 ? notesParts.join(" · ") : undefined,
    },
  });

  revalidatePath("/patients");
  revalidatePath("/reports/new");

  return patient.id;
}
