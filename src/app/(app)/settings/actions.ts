"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { saveClinicSettings } from "@/services/settings/clinicSettings";
import { parseSettingsForm } from "@/services/settings/clinicSettingsSchema";

export type SettingsState = {
  error?: string;
  success?: boolean;
};

async function requireDoctor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
}

export async function saveClinicSettingsAction(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireDoctor();

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
