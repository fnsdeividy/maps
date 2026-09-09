import { prisma } from "@/lib/prisma";
import {
  buildControlReportMetrics,
  CONTROL_SECTOR,
  isOverdue,
  reportCode,
  resolveControlReportPeriod,
  rowMatchesFilters,
  sourceLabel,
  displayStatusLabel,
  formatClinicDateTime,
  type ControlReportFilters,
  type ControlReportRowInput,
} from "@/domain/reports/controlReport";

function toRow(report: {
  id: string;
  createdAt: Date;
  approvedAt: Date | null;
  submittedAt: Date | null;
  status: string;
  source: string;
  active: boolean;
  createdById: string | null;
  createdBy: { name: string } | null;
}): ControlReportRowInput {
  return {
    id: report.id,
    createdAt: report.createdAt,
    approvedAt: report.approvedAt,
    submittedAt: report.submittedAt,
    status: report.status,
    source: report.source,
    active: report.active,
    createdById: report.createdById,
    createdByName: report.createdBy?.name ?? null,
  };
}

async function loadRowsInRange(
  dateField: ControlReportFilters["dateField"],
  start: Date,
  endExclusive: Date,
): Promise<ControlReportRowInput[]> {
  const field = dateField === "completedAt" ? "approvedAt" : "createdAt";
  const reports = await prisma.mapaReport.findMany({
    where: {
      [field]: { gte: start, lt: endExclusive },
    },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return reports.map(toRow);
}

export async function listControlReportAssignees() {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}

export async function getControlReport(filters: ControlReportFilters, now = new Date()) {
  const period = resolveControlReportPeriod(filters, now);
  const [currentRaw, previousRaw, assignees] = await Promise.all([
    loadRowsInRange(filters.dateField, period.start, period.endExclusive),
    loadRowsInRange(
      filters.dateField,
      period.previousStart,
      period.previousEndExclusive,
    ),
    listControlReportAssignees(),
  ]);

  const current = currentRaw.filter((row) => rowMatchesFilters(row, filters));
  const previous = previousRaw.filter((row) => rowMatchesFilters(row, filters));
  const metrics = buildControlReportMetrics(current, previous, now);

  return {
    period,
    filters,
    metrics,
    assignees,
    sector: CONTROL_SECTOR,
    rows: current.map((row) => ({
      id: row.id,
      code: reportCode(row.id),
      createdAtLabel: formatClinicDateTime(row.createdAt),
      completedAtLabel: row.approvedAt ? formatClinicDateTime(row.approvedAt) : "—",
      status: row.status,
      statusLabel: displayStatusLabel(row),
      source: row.source,
      sourceLabel: sourceLabel(row.source),
      sector: CONTROL_SECTOR,
      assignee: row.createdByName ?? "—",
      overdue: isOverdue(row, now),
      active: row.active,
    })),
  };
}
