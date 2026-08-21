import { prisma } from "@/lib/prisma";

export const patientRepository = {
  list() {
    return prisma.patient.findMany({ orderBy: { name: "asc" } });
  },
  getById(id: string) {
    return prisma.patient.findUnique({ where: { id } });
  },
};
