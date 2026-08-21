export type DateOrder = "YMD" | "DMY" | "MDY";

const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const SLASHED_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/;
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Descobre se datas do tipo `a/b/c` são dia-mês-ano ou mês-dia-ano usando
 * apenas evidências do próprio arquivo: basta um registro com o primeiro ou o
 * segundo componente maior que 12 para fixar a ordem de todos os demais.
 *
 * Sem evidência a ordem fica indefinida e os registros são reportados como
 * AMBIGUOUS_DATE em vez de serem interpretados por chute.
 */
export function inferDateOrder(tokens: string[]): DateOrder | undefined {
  let sawSlashed = false;
  for (const token of tokens) {
    if (ISO_DATE.test(token)) return "YMD";
    const match = SLASHED_DATE.exec(token);
    if (!match) continue;
    sawSlashed = true;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second <= 12) return "DMY";
    if (second > 12 && first <= 12) return "MDY";
  }
  return sawSlashed ? undefined : "YMD";
}

export function parseDateParts(
  token: string,
  order: DateOrder | undefined,
): DateParts | undefined {
  const iso = ISO_DATE.exec(token);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }

  const slashed = SLASHED_DATE.exec(token);
  if (!slashed || !order || order === "YMD") return undefined;

  const first = Number(slashed[1]);
  const second = Number(slashed[2]);
  const rawYear = Number(slashed[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  return order === "DMY"
    ? { year, month: second, day: first }
    : { year, month: first, day: second };
}

export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

/** Instantâneo civil do equipamento: sem timezone (CONTEC AWP não declara fuso). */
export interface AwpLocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function parseTimeParts(token: string): TimeParts | undefined {
  const match = TIME.exec(token);
  if (!match) return undefined;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: match[3] ? Number(match[3]) : 0,
  };
}

/**
 * Monta um Date que carrega o wall-clock do aparelho nos componentes UTC.
 * Assim toISOString/RSC/JSON não deslocam 08:35 → 11:35 (UTC−3).
 * Sempre ler/gravar com getUTC* / Date.UTC — nunca getHours local.
 */
export function buildDate(date: DateParts, time: TimeParts): Date | undefined {
  if (date.month < 1 || date.month > 12) return undefined;
  if (date.day < 1 || date.day > 31) return undefined;
  if (time.hour > 23 || time.minute > 59 || time.second > 59) return undefined;

  const value = new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      time.hour,
      time.minute,
      time.second,
      0,
    ),
  );

  const roundTrips =
    value.getUTCFullYear() === date.year &&
    value.getUTCMonth() === date.month - 1 &&
    value.getUTCDate() === date.day &&
    value.getUTCHours() === time.hour &&
    value.getUTCMinutes() === time.minute &&
    value.getUTCSeconds() === time.second;

  return roundTrips ? value : undefined;
}

/** Extrai o wall-clock civil (componentes UTC = horário do aparelho). */
export function toAwpLocalDateTime(value: Date): AwpLocalDateTime {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
    hour: value.getUTCHours(),
    minute: value.getUTCMinutes(),
    second: value.getUTCSeconds(),
  };
}

/** "2026-08-17T08:35:00" — sem Z e sem offset. */
export function toWallClockIso(value: Date | AwpLocalDateTime): string {
  const parts = value instanceof Date ? toAwpLocalDateTime(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

const WALL_CLOCK_ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

/**
 * Reconstrói o Date a partir do wall-clock do equipamento.
 * Aceita "2026-08-17T08:35:00" (sem Z). Strings com Z/offset são rejeitadas
 * para não reintroduzir conversão de fuso nos timestamps AWP.
 */
export function fromWallClockIso(value: string): Date | undefined {
  const trimmed = value.trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) return undefined;
  const match = WALL_CLOCK_ISO.exec(trimmed);
  if (!match) return undefined;
  return buildDate(
    { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) },
    {
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: match[6] ? Number(match[6]) : 0,
    },
  );
}

/** Lê YearBegin/MonBegin/... de uma seção AWP (PATIENTDATA, ABPMDATA). */
export function readSectionLocalDateTime(
  fields: Record<string, string>,
): AwpLocalDateTime | undefined {
  const read = (key: string) => {
    const found = Object.entries(fields).find(
      ([name]) =>
        name.toLowerCase().replace(/[^a-z0-9]/g, "") ===
        key.toLowerCase().replace(/[^a-z0-9]/g, ""),
    );
    return found?.[1]?.trim();
  };
  const year = Number(read("YearBegin"));
  const month = Number(read("MonBegin"));
  const day = Number(read("DayBegin"));
  const hour = Number(read("HourBegin") ?? "0");
  const minute = Number(read("MinBegin") ?? "0");
  const second = Number(read("SecBegin") ?? "0");
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    return undefined;
  }
  const built = buildDate(
    { year, month, day },
    { hour, minute, second },
  );
  return built ? toAwpLocalDateTime(built) : undefined;
}

export function isDateToken(token: string): boolean {
  return ISO_DATE.test(token) || SLASHED_DATE.test(token);
}

export function isTimeToken(token: string): boolean {
  return TIME.test(token);
}

/** "HH:MM" a partir do wall-clock AWP (componentes UTC). */
export function toClockString(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Minutos desde a meia-noite, ou undefined quando o texto não é "HH:MM". */
export function clockToMinutes(clock: string): number | undefined {
  const parts = parseTimeParts(clock.trim());
  if (!parts) return undefined;
  if (parts.hour > 23 || parts.minute > 59) return undefined;
  return parts.hour * 60 + parts.minute;
}
