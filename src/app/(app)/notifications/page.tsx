import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { listNotifications } from "@/services/notifications/notifications";
import { markAllReadAction } from "./actions";

export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = {
  REPORT_SUBMITTED: "Para aprovar",
  REPORT_RETURNED: "Pendências",
  REPORT_APPROVED: "Aprovado",
};

function typeBadgeColor(type: string): string {
  if (type === "REPORT_RETURNED") return "bg-red-100 text-red-800";
  if (type === "REPORT_APPROVED") return "bg-emerald-100 text-emerald-800";
  return "bg-sky-100 text-sky-800";
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.id);
  const hasUnread = notifications.some((notification) => !notification.readAt);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notificações</h1>
        {hasUnread ? (
          <form action={markAllReadAction}>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              type="submit"
            >
              Marcar todas como lidas
            </button>
          </form>
        ) : null}
      </div>

      <ul className="mt-6 space-y-2">
        {notifications.map((notification) => (
          <li
            className={`rounded-lg border p-4 text-sm ${
              notification.readAt
                ? "border-slate-200 bg-white"
                : "border-teal-300 bg-teal-50"
            }`}
            key={notification.id}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeColor(notification.type)}`}
              >
                {typeLabels[notification.type] ?? notification.type}
              </span>
              <span className="text-xs text-slate-500">
                {notification.createdAt.toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{notification.message}</p>
            {notification.reportId ? (
              <Link
                className="mt-2 inline-block text-teal-700 underline"
                href={`/reports/${notification.reportId}`}
              >
                Abrir laudo
              </Link>
            ) : null}
          </li>
        ))}
        {notifications.length === 0 ? (
          <li className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Nenhuma notificação.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
