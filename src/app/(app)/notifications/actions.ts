"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { markAllNotificationsRead } from "@/services/notifications/notifications";

export async function markAllReadAction() {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
