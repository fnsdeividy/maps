import { prisma } from "@/lib/prisma";
import { ROLE_APPROVER, ROLE_OPERATOR } from "@/lib/authz";

/** Avisa todos os aprovadores que um laudo chegou para aprovação. */
export async function notifyApprovers(input: {
  reportId: string;
  message: string;
  excludeUserId?: string;
}) {
  const approvers = await prisma.user.findMany({
    where: { role: ROLE_APPROVER, id: { not: input.excludeUserId } },
    select: { id: true },
  });
  if (approvers.length === 0) return;
  await prisma.notification.createMany({
    data: approvers.map((user) => ({
      userId: user.id,
      reportId: input.reportId,
      type: "REPORT_SUBMITTED",
      message: input.message,
    })),
  });
}

/**
 * Avisa quem criou o laudo sobre pendências ou aprovação.
 * Sem criador registrado, avisa todos os operadores.
 */
export async function notifyReportCreator(input: {
  reportId: string;
  createdById: string | null;
  type: "REPORT_RETURNED" | "REPORT_APPROVED";
  message: string;
}) {
  let userIds: string[] = [];
  if (input.createdById) {
    userIds = [input.createdById];
  } else {
    const operators = await prisma.user.findMany({
      where: { role: ROLE_OPERATOR },
      select: { id: true },
    });
    userIds = operators.map((user) => user.id);
  }
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      reportId: input.reportId,
      type: input.type,
      message: input.message,
    })),
  });
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
