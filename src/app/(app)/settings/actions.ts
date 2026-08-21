"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { saveClinicSettings } from "@/services/settings/clinicSettings";
import { parseSettingsForm } from "@/services/settings/clinicSettingsSchema";

export type SettingsState = {
  error?: string;
  success?: boolean;
};

export type ChangePasswordState = {
  error?: string;
  success?: boolean;
};

export async function changePasswordAction(
  _state: ChangePasswordState | null,
  formData: FormData,
): Promise<ChangePasswordState> {
  const sessionUser = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha todos os campos." };
  }
  if (newPassword.length < 8) {
    return { error: "A nova senha deve ter no mínimo 8 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "A confirmação não confere com a nova senha." };
  }
  if (newPassword === currentPassword) {
    return { error: "A nova senha deve ser diferente da atual." };
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) redirect("/login");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Senha atual incorreta." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function saveClinicSettingsAction(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireUser();

  try {
    const data = parseSettingsForm(formData);
    await saveClinicSettings(data);
  } catch {
    return { error: "Revise os valores informados e tente novamente." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return { success: true };
}
