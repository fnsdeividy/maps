import { prisma } from "@/lib/prisma";

export const reportRepository = {
  list() {
    return prisma.mapaReport.findMany({
      orderBy: { createdAt: "desc" },
      include: { patient: true },
    });
  },
  getById(id: string) {
    return prisma.mapaReport.findUnique({
      where: { id },
      include: { patient: true, logs: { orderBy: { createdAt: "desc" } } },
    });
  },
};
