import { AppSidebar } from "@/components/AppSidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { unreadNotificationCount } from "@/services/notifications/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const unreadCount = await unreadNotificationCount(session.user.id);

  return (
    <div className="min-h-screen print:min-h-0">
      <AppSidebar
        doctorName={session.user.name}
        role={session.user.role}
        unreadCount={unreadCount}
      />
      <main className="ml-64 min-h-screen p-8 print:ml-0 print:min-h-0 print:p-0">{children}</main>
    </div>
  );
}
