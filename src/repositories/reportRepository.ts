import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { examDayRange, normalizeExamDate } from "@/lib/dates";
import { isPrismaUniqueConflict } from "@/lib/prismaErrors";

async function findByPatientAndExamDay(patientId: string, examDate: Date) {
  const { start, endExclusive } = examDayRange(examDate);
  const inDay = await prisma.mapaReport.findFirst({
    where: {
      patientId,
      examDate: { gte: start, lt: endExclusive },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
  if (inDay) return inDay;
  // Fallback da unique (patientId, examDate): pega inativo ou corrida de create.
  return prisma.mapaReport.findUnique({
    where: {
      patientId_examDate: {
        patientId,
        examDate: normalizeExamDate(examDate),
      },
    },
  });
}

export const reportRepository = {
  list() {
    return prisma.mapaReport.findMany({
      where: { active: true },
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
  /**
   * Um laudo por paciente e dia de exame — inclusive inativos.
   * A unique do banco não considera `active`; ignorar inativos faz o create
   * estourar P2002 ao reimportar um exame apagado.
   */
  findByPatientAndExamDay,
  /**
   * Cria o laudo do dia ou reaproveita o registro (reativa se estava inativo).
   * Em corrida de create, trata P2002 e atualiza o que já existe.
   */
  async saveForPatientExamDay(input: {
    patientId: string;
    examDate: Date;
    create: Prisma.MapaReportUncheckedCreateInput;
    update: Prisma.MapaReportUncheckedUpdateInput;
  }) {
    const existing = await findByPatientAndExamDay(
      input.patientId,
      input.examDate,
    );
    if (existing) {
      const report = await prisma.mapaReport.update({
        where: { id: existing.id },
        data: { ...input.update, active: true },
      });
      return { report, existing };
    }

    try {
      const report = await prisma.mapaReport.create({ data: input.create });
      return { report, existing: null };
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error;
      const raced = await findByPatientAndExamDay(
        input.patientId,
        input.examDate,
      );
      if (!raced) throw error;
      const report = await prisma.mapaReport.update({
        where: { id: raced.id },
        data: { ...input.update, active: true },
      });
      return { report, existing: raced };
    }
  },
};
