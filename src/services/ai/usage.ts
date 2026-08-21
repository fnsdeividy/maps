import { prisma } from "@/lib/prisma";

export type UsageRange = "today" | "7d" | "30d" | "custom";

export function rangeToDates(
  range: UsageRange,
  from?: string,
  to?: string,
): { start: Date; end: Date } {
  const end = new Date();
  if (range === "custom" && from && to) {
    return { start: new Date(from), end: new Date(`${to}T23:59:59`) };
  }
  const start = new Date();
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }
  return { start, end };
}

export async function getAiUsageSummary(start: Date, end: Date) {
  const where = { createdAt: { gte: start, lte: end } };
  const [agg, rows, reportCount] = await Promise.all([
    prisma.aiUsage.aggregate({
      where,
      _sum: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        estimatedTotalCost: true,
      },
    }),
    prisma.aiUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { report: { include: { patient: true } } },
    }),
    prisma.aiUsage.findMany({
      where,
      distinct: ["reportId"],
      select: { reportId: true },
    }),
  ]);

  const reportsWithAi = reportCount.length;
  const cost = agg._sum.estimatedTotalCost ?? 0;

  return {
    totalTokens: agg._sum.totalTokens ?? 0,
    inputTokens: agg._sum.inputTokens ?? 0,
    outputTokens: agg._sum.outputTokens ?? 0,
    estimatedCost: cost,
    reportsWithAi,
    averageCost: reportsWithAi ? cost / reportsWithAi : 0,
    rows,
  };
}
