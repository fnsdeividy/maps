import { prisma } from "@/lib/prisma";
import { examDayRange } from "@/lib/dates";

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
  /** Um laudo por paciente e dia de exame; o mais recente se ainda houver duplicata. */
  findByPatientAndExamDay(patientId: string, examDate: Date) {
    const { start, endExclusive } = examDayRange(examDate);
    return prisma.mapaReport.findFirst({
      where: {
        patientId,
        examDate: { gte: start, lt: endExclusive },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
