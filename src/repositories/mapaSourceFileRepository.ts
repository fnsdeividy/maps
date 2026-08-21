import { prisma } from "@/lib/prisma";

export const mapaSourceFileRepository = {
  getById(id: string) {
    return prisma.mapaSourceFile.findUnique({
      where: { id },
      include: { patient: true },
    });
  },

  listRecent(take = 20) {
    return prisma.mapaSourceFile.findMany({
      orderBy: { createdAt: "desc" },
      include: { patient: true },
      take,
    });
  },

  findAnalyzedByHash(fileHash: string) {
    return prisma.mapaSourceFile.findFirst({
      where: { fileHash, status: "ANALYZED" },
      orderBy: { createdAt: "desc" },
    });
  },
};
