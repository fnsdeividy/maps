const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export const SCHEDULE_START_HOUR = 7;
export const SCHEDULE_END_HOUR = 19;
export const SCHEDULE_SLOT_MINUTES = 30;
export const SCHEDULE_DAYS = 6;

export function toScheduleDate(value: Date): string {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function toScheduleTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(
    value.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export function parseScheduleSlot(date: string, time: string): Date | null {
  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const validDate =
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day;
  const validTime =
    hour >= SCHEDULE_START_HOUR &&
    hour < SCHEDULE_END_HOUR &&
    minute % SCHEDULE_SLOT_MINUTES === 0;
  const validWeekday = value.getUTCDay() >= 1 && value.getUTCDay() <= 6;

  return validDate && validTime && validWeekday ? value : null;
}

export function startOfScheduleWeek(value?: string): Date {
  const parsed = value ? parseScheduleDate(value) : null;
  const date = parsed ?? new Date();
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = normalized.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  normalized.setUTCDate(normalized.getUTCDate() - daysSinceMonday);
  return normalized;
}

function parseScheduleDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}
