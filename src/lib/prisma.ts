import { PrismaClient } from "@prisma/client";

/**
 * Incremente quando o schema Prisma mudar de forma que um client
 * em cache no hot-reload fique inválido (campos novos/removidos).
 */
const PRISMA_CLIENT_GENERATION = 7;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaGeneration?: number;
};

function createPrismaClient() {
  return new PrismaClient();
}

function isCurrentClient(client: PrismaClient | undefined): client is PrismaClient {
  return Boolean(
    client &&
      "clinicSettings" in client &&
      globalForPrisma.prismaGeneration === PRISMA_CLIENT_GENERATION,
  );
}

export const prisma = isCurrentClient(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaGeneration = PRISMA_CLIENT_GENERATION;
}
