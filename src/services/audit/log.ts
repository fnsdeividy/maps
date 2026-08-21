import { prisma } from "@/lib/prisma";

export async function logReportEvent(input: {
  reportId: string;
  event: string;
  model?: string;
  promptVersion?: string;
}) {
  await prisma.reportGenerationLog.create({
    data: input,
  });
}
