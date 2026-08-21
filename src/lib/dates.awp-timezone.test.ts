import { describe, expect, it } from "vitest";
import {
  buildDate,
  fromWallClockIso,
  toWallClockIso,
} from "@/domain/mapa/import/awp/decoders/dateTime";
import {
  examDayRange,
  formatDateTime,
  fromStoredDateTime,
  normalizeExamDate,
  toStoredDateTime,
} from "@/lib/dates";

describe("AWP wall-clock timezone", () => {
  it("serializa sem Z e formata 17/08/2026 08:35", () => {
    const measuredAt = buildDate(
      { year: 2026, month: 8, day: 17 },
      { hour: 8, minute: 35, second: 0 },
    );
    expect(measuredAt).toBeDefined();
    if (!measuredAt) return;

    const stored = toStoredDateTime(measuredAt);
    expect(stored).toBe("2026-08-17T08:35:00");
    expect(stored.endsWith("Z")).toBe(false);

    const revived = fromStoredDateTime(stored);
    expect(formatDateTime(revived)).toBe("17/08/2026, 08:35:00");
    expect(formatDateTime(revived)).not.toContain("05:35");
    expect(formatDateTime(revived)).not.toContain("11:35");
    // Carrier UTC: wall-clock fica em getUTC*, independente do fuso da máquina.
    expect(revived.getUTCHours()).toBe(8);
    expect(revived.getUTCMinutes()).toBe(35);
    expect(revived.toISOString()).toBe("2026-08-17T08:35:00.000Z");
  });

  it("não interpreta wall-clock com sufixo Z via fromWallClockIso", () => {
    expect(fromWallClockIso("2026-08-17T08:35:00Z")).toBeUndefined();
    expect(
      toWallClockIso(
        buildDate({ year: 2026, month: 8, day: 17 }, { hour: 8, minute: 35, second: 0 })!,
      ),
    ).toBe("2026-08-17T08:35:00");
  });

  it("legado ISO com Z usa componentes UTC como wall-clock (não reaplica −3)", () => {
    const revived = fromStoredDateTime("2026-08-17T08:35:00.000Z");
    expect(revived.getUTCHours()).toBe(8);
    expect(revived.getUTCMinutes()).toBe(35);
    expect(formatDateTime(revived)).toBe("17/08/2026, 08:35:00");
  });

  it("paciente + dia civil identificam o mesmo exame mesmo com horário diferente", () => {
    const morning = new Date(Date.UTC(2026, 6, 27, 8, 0, 0));
    const evening = new Date(Date.UTC(2026, 6, 27, 19, 1, 0));
    const formDate = new Date("2026-07-27");
    expect(normalizeExamDate(morning).toISOString()).toBe(
      "2026-07-27T00:00:00.000Z",
    );
    expect(normalizeExamDate(evening).getTime()).toBe(
      normalizeExamDate(morning).getTime(),
    );
    expect(normalizeExamDate(formDate).getTime()).toBe(
      normalizeExamDate(morning).getTime(),
    );
    const { start, endExclusive } = examDayRange(evening);
    expect(morning >= start && morning < endExclusive).toBe(true);
    expect(evening >= start && evening < endExclusive).toBe(true);
    const nextDay = new Date(Date.UTC(2026, 6, 28, 0, 0, 0));
    expect(nextDay >= start && nextDay < endExclusive).toBe(false);
  });

  it("formata string ISO serializada pelo RSC sem deslocar para 11:35", () => {
    const measuredAt = buildDate(
      { year: 2026, month: 8, day: 17 },
      { hour: 8, minute: 35, second: 0 },
    )!;
    // Simula o que o React/RSC faz ao passar Date para o client.
    const serialized = measuredAt.toISOString();
    expect(serialized).toBe("2026-08-17T08:35:00.000Z");
    expect(formatDateTime(serialized)).toBe("17/08/2026, 08:35:00");
  });
});
