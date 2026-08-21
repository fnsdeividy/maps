import {
  fromWallClockIso,
  toAwpLocalDateTime,
  toWallClockIso,
  type AwpLocalDateTime,
} from "@/domain/mapa/import/awp/decoders/dateTime";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Resolve Date ou wall-clock ISO para o horário civil do aparelho.
 * Datas AWP usam componentes UTC como transporte (08:35 do aparelho = 08:35Z),
 * para não virar 11:35 no Brasil nem 05:35 no servidor UTC.
 */
function wallClockParts(value: Date | string): AwpLocalDateTime {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const fromWall = fromWallClockIso(trimmed);
    if (fromWall) return toAwpLocalDateTime(fromWall);
    // Legado com Z: os componentes UTC já são o wall-clock (carrier).
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      const utc = new Date(trimmed);
      return {
        year: utc.getUTCFullYear(),
        month: utc.getUTCMonth() + 1,
        day: utc.getUTCDate(),
        hour: utc.getUTCHours(),
        minute: utc.getUTCMinutes(),
        second: utc.getUTCSeconds(),
      };
    }
    const match =
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        hour: Number(match[4] ?? 0),
        minute: Number(match[5] ?? 0),
        second: Number(match[6] ?? 0),
      };
    }
  }
  return toAwpLocalDateTime(typeof value === "string" ? new Date(value) : value);
}

/** DD/MM/YYYY a partir do wall-clock (sem conversão de fuso). */
export function formatDate(value: Date | string) {
  const parts = wallClockParts(value);
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

/** DD/MM/YYYY HH:MM:SS — horário do equipamento, sem UTC±offset. */
export function formatDateTime(value: Date | string) {
  const parts = wallClockParts(value);
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}, ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function formatTime(value: Date | string) {
  const parts = wallClockParts(value);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function toInputDate(value: Date | string) {
  const parts = wallClockParts(value);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Meia-noite UTC do dia civil do exame — chave paciente + data. */
export function normalizeExamDate(value: Date | string): Date {
  const parts = wallClockParts(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/** Intervalo [início, fim) do dia civil do exame, em UTC. */
export function examDayRange(value: Date | string): {
  start: Date;
  endExclusive: Date;
} {
  const start = normalizeExamDate(value);
  const endExclusive = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1),
  );
  return { start, endExclusive };
}

/** Serialização estável para JSON/payload AWP (nunca depende do fuso da máquina). */
export function toStoredDateTime(value: Date): string {
  return toWallClockIso(value);
}

/** Reconstrói Date AWP (wall-clock nos componentes UTC). */
export function fromStoredDateTime(value: string): Date {
  const wall = fromWallClockIso(value);
  if (wall) return wall;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) {
    const utc = new Date(value);
    // Mantém os dígitos UTC como wall-clock (já é o carrier).
    return new Date(
      Date.UTC(
        utc.getUTCFullYear(),
        utc.getUTCMonth(),
        utc.getUTCDate(),
        utc.getUTCHours(),
        utc.getUTCMinutes(),
        utc.getUTCSeconds(),
        0,
      ),
    );
  }
  const parsed = new Date(value);
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      parsed.getUTCHours(),
      parsed.getUTCMinutes(),
      parsed.getUTCSeconds(),
      0,
    ),
  );
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  });
}
