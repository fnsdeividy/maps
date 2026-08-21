"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { patientSchema } from "@/lib/validation";
import { auth } from "@/auth";

async function requireDoctor() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
}

export async function createPatient(formData: FormData) {
  await requireDoctor();
  const parsed = patientSchema.parse({
    name: formData.get("name"),
    birthDate: formData.get("birthDate"),
    gender: formData.get("gender"),
    document: String(formData.get("document") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });

  await prisma.patient.create({
    data: {
      name: parsed.name,
      birthDate: new Date(parsed.birthDate),
      gender: parsed.gender,
      document: parsed.document,
      notes: parsed.notes,
    },
  });

  revalidatePath("/patients");
  redirect("/patients");
}

export async function updatePatient(id: string, formData: FormData) {
  await requireDoctor();
  const parsed = patientSchema.parse({
    name: formData.get("name"),
    birthDate: formData.get("birthDate"),
    gender: formData.get("gender"),
    document: String(formData.get("document") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });

  await prisma.patient.update({
    where: { id },
    data: {
      name: parsed.name,
      birthDate: new Date(parsed.birthDate),
      gender: parsed.gender,
      document: parsed.document,
      notes: parsed.notes,
    },
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  redirect("/patients");
}

export async function deletePatient(id: string) {
  await requireDoctor();
  await prisma.patient.delete({ where: { id } });
  revalidatePath("/patients");
  redirect("/patients");
}
