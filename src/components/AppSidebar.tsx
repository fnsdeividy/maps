"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(auth)/login/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Pacientes" },
  { href: "/reports", label: "Laudos" },
  { href: "/reports/new", label: "Novo Laudo" },
  { href: "/phrases", label: "Frases" },
  { href: "/notifications", label: "Notificações" },
  { href: "/ai-usage", label: "Consumo de IA" },
  { href: "/settings", label: "Configurações" },
  // ...(process.env.NODE_ENV === "development"
  //   ? [{ href: "/dev/awp-inspector", label: "AWP Inspector (dev)" }]
  //   : []),
];

const roleLabels: Record<string, string> = {
  DOCTOR: "Aprovador",
  OPERATOR: "Operador",
};

export function AppSidebar({
  doctorName,
  role,
  unreadCount = 0,
}: {
  doctorName?: string | null;
  role?: string | null;
  unreadCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-slate-900 text-slate-100 print:hidden">
      <div className="border-b border-slate-700 px-5 py-5">
        <p className="text-xs uppercase tracking-widest text-teal-300">MAPA</p>
        <h1 className="text-lg font-semibold">Laudos clínicos</h1>
        <p className="mt-1 text-xs text-slate-400">
          {doctorName}
          {role && roleLabels[role] ? ` · ${roleLabels[role]}` : ""}
        </p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/dashboard" &&
              link.href !== "/reports/new" &&
              pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-teal-700 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{link.label}</span>
              {link.href === "/notifications" && unreadCount > 0 ? (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <form action={logoutAction} className="border-t border-slate-700 p-4">
        <button className="text-sm text-slate-400 hover:text-white" type="submit">
          Sair
        </button>
      </form>
    </aside>
  );
}
