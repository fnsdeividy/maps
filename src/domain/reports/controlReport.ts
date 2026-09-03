/** Fuso operacional da clínica (Brasil sem horário de verão desde 2019). */
export const CLINIC_TIME_ZONE = "America/Sao_Paulo";
export const CLINIC_UTC_OFFSET = "-03:00";

/** Laudo em atraso: não aprovado e com mais de 48h desde a criação. */
export const OVERDUE_AFTER_HOURS = 48;

export const CONTROL_SECTOR = "MAPA";

export type ControlFrequency = "daily" | "weekly" | "monthly" | "custom";
export type ControlDateField = "createdAt" | "completedAt";

export type ControlReportFilters = {
  frequency: ControlFrequency;
  from?: string;
  to?: string;
  dateField: ControlDateField;
  status: string;
  source: string;
  createdById: string;
  sector: string;
};

export type ControlStatusBucket =
  | "draft"
  | "processing"
  | "completed"
  | "returned"
  | "cancelled";

export const CONTROL_STATUS_BUCKETS: Array<{
  id: ControlStatusBucket;
  label: string;
  hint: string;
}> = [
  { id: "draft", label: "Rascunho / pendente", hint: "Status DRAFT" },
  {
    id: "processing",
    label: "Em processamento",
    hint: "Gerado ou aguardando aprovação",
  },
  { id: "completed", label: "Concluído / aprovado", hint: "Status APPROVED" },
  {
    id: "returned",
    label: "Com erro / rejeitado",
    hint: "Devolvido com pendências (CHANGES_REQUESTED)",
  },
  {
    id: "cancelled",
    label: "Cancelado",
    hint: "Laudo inativado (exclusão lógica)",
  },
];

export const NATIVE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerado",
  PENDING_APPROVAL: "Aguardando aprovação",
  CHANGES_REQUESTED: "Com pendências",
  APPROVED: "Aprovado",
};

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  FILE: "Arquivo AWP",
};

export type ControlReportRowInput = {
  id: string;
  createdAt: Date;
  approvedAt: Date | null;
  submittedAt: Date | null;
  status: string;
  source: string;
  active: boolean;
  createdById: string | null;
  createdByName: string | null;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKeyInClinicZone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function startOfClinicDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000${CLINIC_UTC_OFFSET}`);
}

export function addClinicDays(ymd: string, days: number): string {
  const start = startOfClinicDay(ymd);
  return dateKeyInClinicZone(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

export function addClinicMonths(ymd: string, months: number): string {
  const [year, month] = ymd.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-01`;
}

export function parseControlReportFilters(
  params: Record<string, string | undefined>,
): ControlReportFilters {
  const frequency = params.frequency;
  return {
    frequency:
      frequency === "daily" ||
      frequency === "weekly" ||
      frequency === "monthly" ||
      frequency === "custom"
        ? frequency
        : "monthly",
    from: params.from || undefined,
    to: params.to || undefined,
    dateField: params.dateField === "completedAt" ? "completedAt" : "createdAt",
    status: params.status || "all",
    source: params.source || "all",
    createdById: params.createdById || "all",
    sector: params.sector || "all",
  };
}

export function controlReportSearchParams(filters: ControlReportFilters): string {
  const params = new URLSearchParams();
  params.set("frequency", filters.frequency);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("dateField", filters.dateField);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.createdById !== "all") params.set("createdById", filters.createdById);
  if (filters.sector !== "all") params.set("sector", filters.sector);
  return params.toString();
}

export type ResolvedPeriod = {
  start: Date;
  endExclusive: Date;
  previousStart: Date;
  previousEndExclusive: Date;
  fromKey: string;
  toKey: string;
  label: string;
};

export function resolveControlReportPeriod(
  filters: ControlReportFilters,
  now = new Date(),
): ResolvedPeriod {
  const today = dateKeyInClinicZone(now);
  let fromKey: string;
  let toExclusiveKey: string;

  if (filters.frequency === "daily") {
    fromKey = today;
    toExclusiveKey = addClinicDays(today, 1);
  } else if (filters.frequency === "weekly") {
    fromKey = addClinicDays(today, -6);
    toExclusiveKey = addClinicDays(today, 1);
  } else if (filters.frequency === "custom" && filters.from && filters.to) {
    fromKey = filters.from;
    toExclusiveKey = addClinicDays(filters.to, 1);
  } else {
    fromKey = `${today.slice(0, 7)}-01`;
    toExclusiveKey = addClinicMonths(fromKey, 1);
  }

  if (fromKey > addClinicDays(toExclusiveKey, -1)) {
    toExclusiveKey = addClinicDays(fromKey, 1);
  }

  const start = startOfClinicDay(fromKey);
  const endExclusive = startOfClinicDay(toExclusiveKey);
  const toKey = addClinicDays(toExclusiveKey, -1);

  let previousStart: Date;
  let previousEndExclusive: Date;
  if (filters.frequency === "monthly" && !filters.from) {
    const prevMonth = addClinicMonths(fromKey, -1);
    previousStart = startOfClinicDay(prevMonth);
    previousEndExclusive = start;
  } else {
    const durationMs = endExclusive.getTime() - start.getTime();
    previousEndExclusive = start;
    previousStart = new Date(start.getTime() - durationMs);
  }

  return {
    start,
    endExclusive,
    previousStart,
    previousEndExclusive,
    fromKey,
    toKey,
    label: `${formatClinicDate(start)} a ${formatClinicDate(new Date(endExclusive.getTime() - 1))}`,
  };
}

export function formatClinicDate(value: Date): string {
  const key = dateKeyInClinicZone(value);
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

export function formatClinicDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function reportCode(id: string): string {
  return id.slice(-8).toUpperCase();
}

export function statusBucketOf(row: {
  status: string;
  active: boolean;
}): ControlStatusBucket {
  if (!row.active) return "cancelled";
  if (row.status === "DRAFT") return "draft";
  if (row.status === "GENERATED" || row.status === "PENDING_APPROVAL") {
    return "processing";
  }
  if (row.status === "APPROVED") return "completed";
  if (row.status === "CHANGES_REQUESTED") return "returned";
  return "processing";
}

export function displayStatusLabel(row: { status: string; active: boolean }): string {
  if (!row.active) return "Cancelado";
  return NATIVE_STATUS_LABELS[row.status] ?? row.status;
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatPercentChange(value: number | null): string {
  if (value == null) return "sem base no período anterior";
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (value > 0) return `+${formatted}%`;
  return `${formatted}%`;
}

export function formatHours(hours: number | null): string {
  if (hours == null) return "—";
  return `${hours.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} h`;
}

export function averageProcessingHours(
  rows: Array<{ createdAt: Date; approvedAt: Date | null; active: boolean }>,
  now = new Date(),
): number | null {
  void now;
  const durations = rows
    .filter((row) => row.active && row.approvedAt)
    .map((row) => (row.approvedAt!.getTime() - row.createdAt.getTime()) / 3_600_000);
  if (durations.length === 0) return null;
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return Math.round(avg * 10) / 10;
}

export function isOverdue(
  row: { createdAt: Date; status: string; active: boolean },
  now = new Date(),
): boolean {
  if (!row.active) return false;
  if (row.status === "APPROVED") return false;
  const ageHours = (now.getTime() - row.createdAt.getTime()) / 3_600_000;
  return ageHours > OVERDUE_AFTER_HOURS;
}

export function completionRate(rows: ControlReportRowInput[]): number | null {
  if (rows.length === 0) return null;
  const completed = rows.filter((row) => statusBucketOf(row) === "completed").length;
  return Math.round((completed / rows.length) * 1000) / 10;
}

export function errorRate(rows: ControlReportRowInput[]): number | null {
  if (rows.length === 0) return null;
  const returned = rows.filter((row) => statusBucketOf(row) === "returned").length;
  return Math.round((returned / rows.length) * 1000) / 10;
}

export function countByBucket(
  rows: ControlReportRowInput[],
): Record<ControlStatusBucket, number> {
  const counts: Record<ControlStatusBucket, number> = {
    draft: 0,
    processing: 0,
    completed: 0,
    returned: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    counts[statusBucketOf(row)] += 1;
  }
  return counts;
}

export function rowMatchesFilters(
  row: ControlReportRowInput,
  filters: ControlReportFilters,
): boolean {
  if (filters.sector !== "all" && filters.sector !== CONTROL_SECTOR) return false;
  if (filters.source !== "all" && row.source !== filters.source) return false;
  if (filters.createdById !== "all" && row.createdById !== filters.createdById) {
    return false;
  }
  if (filters.status === "all") return true;
  if (filters.status === "INACTIVE" || filters.status === "cancelled") {
    return !row.active;
  }
  if (filters.status === "draft") return statusBucketOf(row) === "draft";
  if (filters.status === "processing") return statusBucketOf(row) === "processing";
  if (filters.status === "completed") return statusBucketOf(row) === "completed";
  if (filters.status === "returned") return statusBucketOf(row) === "returned";
  return row.active && row.status === filters.status;
}

export type ControlReportMetrics = {
  total: number;
  previousTotal: number;
  totalChange: number | null;
  buckets: Record<ControlStatusBucket, number>;
  averageProcessingHours: number | null;
  completionRate: number | null;
  errorRate: number | null;
  overdueCount: number;
};

export function buildControlReportMetrics(
  current: ControlReportRowInput[],
  previous: ControlReportRowInput[],
  now = new Date(),
): ControlReportMetrics {
  return {
    total: current.length,
    previousTotal: previous.length,
    totalChange: percentChange(current.length, previous.length),
    buckets: countByBucket(current),
    averageProcessingHours: averageProcessingHours(current, now),
    completionRate: completionRate(current),
    errorRate: errorRate(current),
    overdueCount: current.filter((row) => isOverdue(row, now)).length,
  };
}

export function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(csvEscape).join(";"),
    ...rows.map((row) => row.map(csvEscape).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toExcelXml(sheetName: string, headers: string[], rows: string[][]): string {
  return toExcelXmlWorkbook([{ name: sheetName, headers, rows }]);
}

export function toExcelXmlWorkbook(
  sheets: Array<{ name: string; headers: string[]; rows: string[][] }>,
): string {
  const worksheets = sheets
    .map((sheet) => {
      const headerCells = sheet.headers
        .map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`)
        .join("");
      const body = sheet.rows
        .map((row) => {
          const cells = row
            .map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`)
            .join("");
          return `<Row>${cells}</Row>`;
        })
        .join("");
      return `<Worksheet ss:Name="${xmlEscape(sheet.name)}">
<Table>
<Row>${headerCells}</Row>
${body}
</Table>
</Worksheet>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets}
</Workbook>`;
}
