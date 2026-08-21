import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const ROLE_OPERATOR = "OPERATOR";
export const ROLE_APPROVER = "DOCTOR";

export function isApprover(role?: string | null): boolean {
  return role === ROLE_APPROVER;
}

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
};

/** Qualquer usuário autenticado (operador ou aprovador). */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

/** Só o aprovador pode aprovar, devolver com pendências ou editar laudo enviado. */
export async function requireApprover(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isApprover(user.role)) redirect("/reports?error=sem-permissao");
  return user;
}
