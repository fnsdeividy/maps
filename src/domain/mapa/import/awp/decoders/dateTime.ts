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

export function parseTimeParts(token: string): TimeParts | undefined {
  const match = TIME.exec(token);
  if (!match) return undefined;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: match[3] ? Number(match[3]) : 0,
  };
}

/** Monta a data no fuso local, que é o fuso em que o equipamento gravou. */
export function buildDate(date: DateParts, time: TimeParts): Date | undefined {
  if (date.month < 1 || date.month > 12) return undefined;
  if (date.day < 1 || date.day > 31) return undefined;
  if (time.hour > 23 || time.minute > 59 || time.second > 59) return undefined;

  const value = new Date(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second,
    0,
  );

  const roundTrips =
    value.getFullYear() === date.year &&
    value.getMonth() === date.month - 1 &&
    value.getDate() === date.day;

  return roundTrips ? value : undefined;
}

export function isDateToken(token: string): boolean {
  return ISO_DATE.test(token) || SLASHED_DATE.test(token);
}

export function isTimeToken(token: string): boolean {
  return TIME.test(token);
}

/** "HH:MM" a partir de um Date, sem depender de locale. */
export function toClockString(value: Date): string {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Minutos desde a meia-noite, ou undefined quando o texto não é "HH:MM". */
export function clockToMinutes(clock: string): number | undefined {
  const parts = parseTimeParts(clock.trim());
  if (!parts) return undefined;
  if (parts.hour > 23 || parts.minute > 59) return undefined;
  return parts.hour * 60 + parts.minute;
}
