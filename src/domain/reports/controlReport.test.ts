import { describe, expect, it } from "vitest";
import {
  addClinicDays,
  averageProcessingHours,
  buildControlReportMetrics,
  controlReportSearchParams,
  csvEscape,
  dateKeyInClinicZone,
  errorRate,
  formatPercentChange,
  isOverdue,
  parseControlReportFilters,
  percentChange,
  reportCode,
  resolveControlReportPeriod,
  rowMatchesFilters,
  startOfClinicDay,
  statusBucketOf,
  toCsv,
  toExcelXml,
  type ControlReportRowInput,
} from "@/domain/reports/controlReport";

function row(
  overrides: Partial<ControlReportRowInput> & { createdAt: Date },
): ControlReportRowInput {
  return {
    id: "clxxxxxxxx",
    approvedAt: null,
    submittedAt: null,
    status: "DRAFT",
    source: "FILE",
    active: true,
    createdByName: "Operador",
    createdById: "user-1",
    ...overrides,
  };
}

describe("períodos do relatório de controle", () => {
  it("resolve o dia operacional em São Paulo", () => {
    expect(dateKeyInClinicZone(new Date("2026-09-02T02:30:00.000Z"))).toBe("2026-09-01");
    expect(startOfClinicDay("2026-09-01").toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("mensal usa o mês civil e o mês anterior como comparativo", () => {
    const period = resolveControlReportPeriod(
      parseControlReportFilters({ frequency: "monthly" }),
      new Date("2026-09-15T15:00:00.000Z"),
    );
    expect(period.fromKey).toBe("2026-09-01");
    expect(period.toKey).toBe("2026-09-30");
    expect(dateKeyInClinicZone(period.previousStart)).toBe("2026-08-01");
    expect(period.previousEndExclusive.getTime()).toBe(period.start.getTime());
  });

  it("semanal cobre 7 dias incluindo hoje", () => {
    const period = resolveControlReportPeriod(
      parseControlReportFilters({ frequency: "weekly" }),
      new Date("2026-09-02T15:00:00.000Z"),
    );
    expect(period.fromKey).toBe("2026-08-27");
    expect(period.toKey).toBe("2026-09-02");
  });

  it("período customizado usa o intervalo informado e o mesmo tamanho no anterior", () => {
    const period = resolveControlReportPeriod(
      parseControlReportFilters({
        frequency: "custom",
        from: "2026-09-01",
        to: "2026-09-02",
      }),
      new Date("2026-09-02T15:00:00.000Z"),
    );
    expect(period.fromKey).toBe("2026-09-01");
    expect(period.toKey).toBe("2026-09-02");
    expect(addClinicDays(dateKeyInClinicZone(period.previousStart), 2)).toBe("2026-09-01");
  });
});

describe("indicadores", () => {
  const now = new Date("2026-09-02T15:00:00.000Z");

  it("agrupa status reais da plataforma nos buckets do relatório", () => {
    expect(statusBucketOf({ status: "DRAFT", active: true })).toBe("draft");
    expect(statusBucketOf({ status: "GENERATED", active: true })).toBe("processing");
    expect(statusBucketOf({ status: "PENDING_APPROVAL", active: true })).toBe("processing");
    expect(statusBucketOf({ status: "APPROVED", active: true })).toBe("completed");
    expect(statusBucketOf({ status: "CHANGES_REQUESTED", active: true })).toBe("returned");
    expect(statusBucketOf({ status: "APPROVED", active: false })).toBe("cancelled");
  });

  it("calcula variação percentual e trata ausência de base", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull();
    expect(formatPercentChange(20)).toBe("+20,0%");
    expect(formatPercentChange(-12.5)).toBe("-12,5%");
  });

  it("média de processamento usa só laudos aprovados", () => {
    const hours = averageProcessingHours(
      [
        row({
          createdAt: new Date("2026-09-01T10:00:00.000Z"),
          approvedAt: new Date("2026-09-01T12:00:00.000Z"),
          status: "APPROVED",
        }),
        row({
          createdAt: new Date("2026-09-01T10:00:00.000Z"),
          approvedAt: new Date("2026-09-01T16:00:00.000Z"),
          status: "APPROVED",
        }),
        row({
          createdAt: new Date("2026-09-01T10:00:00.000Z"),
          status: "DRAFT",
        }),
      ],
      now,
    );
    expect(hours).toBe(4);
  });

  it("atraso: não aprovado e com mais de 48h", () => {
    expect(
      isOverdue(
        row({
          createdAt: new Date("2026-08-30T14:00:00.000Z"),
          status: "PENDING_APPROVAL",
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isOverdue(
        row({
          createdAt: new Date("2026-08-30T14:00:00.000Z"),
          status: "APPROVED",
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isOverdue(
        row({
          createdAt: new Date("2026-09-02T10:00:00.000Z"),
          status: "DRAFT",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("taxas de conclusão e erro usam o total do período como denominador", () => {
    const rows = [
      row({ createdAt: now, status: "APPROVED" }),
      row({ createdAt: now, status: "APPROVED" }),
      row({ createdAt: now, status: "CHANGES_REQUESTED" }),
      row({ createdAt: now, status: "DRAFT" }),
    ];
    expect(errorRate(rows)).toBe(25);
    const metrics = buildControlReportMetrics(rows, [row({ createdAt: now })], now);
    expect(metrics.completionRate).toBe(50);
    expect(metrics.buckets.draft).toBe(1);
    expect(metrics.totalChange).toBe(300);
  });

  it("código curto vem do final do id", () => {
    expect(reportCode("clabc123xyz9")).toBe("C123XYZ9");
  });

  it("filtra por responsável", () => {
    const filters = parseControlReportFilters({ createdById: "user-2" });
    expect(
      rowMatchesFilters(
        row({ createdAt: now, createdById: "user-1" }),
        filters,
      ),
    ).toBe(false);
    expect(
      rowMatchesFilters(
        row({ createdAt: now, createdById: "user-2" }),
        filters,
      ),
    ).toBe(true);
  });
});

describe("exportação", () => {
  it("CSV usa ponto e vírgula e escapa aspas", () => {
    expect(csvEscape('12; "x"')).toBe('"12; ""x"""');
    const csv = toCsv(["A", "B"], [["1", "dois"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("A;B");
  });

  it("Excel XML escapa caracteres especiais", () => {
    const xml = toExcelXml("Controle", ["Nome"], [["<laudo & co>"]]);
    expect(xml).toContain("&lt;laudo &amp; co&gt;");
    expect(xml).toContain("Excel.Sheet");
  });

  it("serializa filtros na query string", () => {
    const qs = controlReportSearchParams(
      parseControlReportFilters({
        frequency: "weekly",
        status: "APPROVED",
        dateField: "completedAt",
      }),
    );
    expect(qs).toContain("frequency=weekly");
    expect(qs).toContain("status=APPROVED");
    expect(qs).toContain("dateField=completedAt");
  });
});
