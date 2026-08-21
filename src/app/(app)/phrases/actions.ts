"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireApprover } from "@/lib/authz";
import { isPhraseCategory } from "@/domain/mapa/phraseCategories";

function slug(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return (uuid ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createPhraseAction(formData: FormData) {
  await requireApprover();
  const category = String(formData.get("category") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!isPhraseCategory(category) || !text) {
    redirect("/phrases?error=preencha-categoria-e-texto");
  }
  await prisma.reportPhrase.create({
    data: {
      code: `CUSTOM_${category}_${slug()}`,
      category,
      text,
      active: true,
    },
  });
  revalidatePath("/phrases");
  redirect("/phrases?ok=criada");
}

export async function updatePhraseAction(code: string, formData: FormData) {
  await requireApprover();
  const category = String(formData.get("category") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const active = formData.get("active") != null;
  if (!isPhraseCategory(category) || !text) {
    redirect("/phrases?error=preencha-categoria-e-texto");
  }
  await prisma.reportPhrase.update({
    where: { code },
    data: { category, text, active },
  });
  revalidatePath("/phrases");
  redirect("/phrases?ok=salva");
}
