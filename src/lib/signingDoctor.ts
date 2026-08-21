import { prisma } from "@/lib/prisma";
import { ROLE_APPROVER } from "@/lib/authz";

const DEFAULT_SIGNING_DOCTOR = {
  name: "Dr. Marcos Heber Lima",
  rqe: "37228",
} as const;

/** Médico que assina o laudo (aprovador), com RQE para a via impressa. */
export async function getSigningDoctor(): Promise<{
  name: string;
  rqe: string;
}> {
  const doctor = await prisma.user.findFirst({
    where: { role: ROLE_APPROVER },
    orderBy: { updatedAt: "desc" },
    select: { name: true, rqe: true },
  });

  return {
    name: doctor?.name?.trim() || DEFAULT_SIGNING_DOCTOR.name,
    rqe: doctor?.rqe?.trim() || DEFAULT_SIGNING_DOCTOR.rqe,
  };
}
