import { countPendingSettings, getClinicSettings } from "@/services/settings/clinicSettings";
import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalReports,
    monthReports,
    drafts,
    approved,
    patients,
    monthUsage,
    recentReports,
    clinicSettings,
  ] = await Promise.all([
    prisma.mapaReport.count(),
    prisma.mapaReport.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.mapaReport.count({ where: { status: "DRAFT" } }),
    prisma.mapaReport.count({ where: { status: "APPROVED" } }),
    prisma.patient.count(),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { totalTokens: true, estimatedTotalCost: true },
    }),
    prisma.mapaReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { patient: true },
    }),
    getClinicSettings(),
  ]);

  return {
    totalReports,
    monthReports,
    drafts,
    approved,
    patients,
    monthTokens: monthUsage._sum.totalTokens ?? 0,
    monthCost: monthUsage._sum.estimatedTotalCost ?? 0,
    recentReports,
    pendingConfig: countPendingSettings(clinicSettings.thresholds),
  };
}
