import { findMetadata } from "./AwpDocumentReader";
import { clockToMinutes } from "./decoders/dateTime";
import type {
  AwpDocument,
  AwpSchedule,
  AwpSleepWindow,
  ParseWarning,
} from "./types";

const SLEEP_START_KEYS = [
  "SleepStart",
  "SleepBegin",
  "SleepTime",
  "SleepFrom",
  "NightStart",
  "NightBegin",
  "NightFrom",
  "AsleepTime",
  "BedTime",
  "HoraDormiu",
  "InicioSono",
];

const SLEEP_END_KEYS = [
  "SleepEnd",
  "SleepStop",
  "SleepTo",
  "WakeTime",
  "WakeUpTime",
  "AwakeTime",
  "NightEnd",
  "NightTo",
  "DayStart",
  "GetUpTime",
  "HoraAcordou",
  "FimSono",
];

/** Extrai "HH:MM" de valores como "22:45", "22:45:00" ou "2024-09-13 22:45". */
function extractClock(value: string): string | undefined {
  const match = /(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  const clock = `${match[1].padStart(2, "0")}:${match[2]}`;
  return clockToMinutes(clock) === undefined ? undefined : clock;
}

function padClock(hour: number, minute: number): string | undefined {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return undefined;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function readInt(document: AwpDocument, keys: string[]): number | undefined {
  const entry = findMetadata(document, keys);
  if (!entry) return undefined;
  const parsed = Number.parseInt(entry.value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Configuração de horários do equipamento (AwakeHour/AsleepHour + intervalos).
 * Não é o diário do paciente — é o que o aparelho foi programado para usar.
 */
export function readDeviceSchedule(document: AwpDocument): AwpSchedule | undefined {
  const awakeHour = readInt(document, ["AwakeHour"]);
  const awakeMin = readInt(document, ["AwakeMin"]) ?? 0;
  const asleepHour = readInt(document, ["AsleepHour"]);
  const asleepMin = readInt(document, ["AsleepMin"]) ?? 0;

  if (awakeHour === undefined || asleepHour === undefined) return undefined;

  const awakeStart = padClock(awakeHour, awakeMin);
  const asleepStart = padClock(asleepHour, asleepMin);
  if (!awakeStart || !asleepStart) return undefined;

  const awakeDuration = readInt(document, ["AwakeDuration"]);
  const asleepDuration = readInt(document, ["AsleepDuration"]);

  return {
    awakeStart,
    asleepStart,
    awakeMeasurementIntervalMinutes:
      awakeDuration !== undefined && awakeDuration > 0 ? awakeDuration : undefined,
    asleepMeasurementIntervalMinutes:
      asleepDuration !== undefined && asleepDuration > 0 ? asleepDuration : undefined,
    source: "DEVICE_CONFIGURATION",
  };
}

/**
 * Procura o período de sono declarado pelo arquivo (diário do paciente) ou,
 * na ausência dele, a configuração Awake/Asleep do equipamento.
 */
export function readSleepWindow(document: AwpDocument): {
  window?: AwpSleepWindow;
  schedule?: AwpSchedule;
  warnings: ParseWarning[];
} {
  const schedule = readDeviceSchedule(document);

  const startEntry = findMetadata(document, SLEEP_START_KEYS);
  const endEntry = findMetadata(document, SLEEP_END_KEYS);
  const start = startEntry ? extractClock(startEntry.value) : undefined;
  const end = endEntry ? extractClock(endEntry.value) : undefined;

  if (start && end) {
    return {
      schedule,
      window: {
        start,
        end,
        source: "FILE",
        evidence: [
          `${startEntry?.key}=${startEntry?.value}`,
          `${endEntry?.key}=${endEntry?.value}`,
        ],
      },
      warnings: [],
    };
  }

  if (schedule) {
    return {
      schedule,
      window: {
        // Janela usada nos cálculos: início do sono → início da vigília.
        start: schedule.asleepStart,
        end: schedule.awakeStart,
        source: "DEVICE_CONFIGURATION",
        evidence: [
          `AsleepHour/Min=${schedule.asleepStart}`,
          `AwakeHour/Min=${schedule.awakeStart}`,
        ],
      },
      warnings: [],
    };
  }

  return {
    warnings: [
      {
        code: "SLEEP_WINDOW_NOT_FOUND",
        message:
          "O arquivo não informa os horários de sono e despertar. Eles precisam ser informados manualmente antes do cálculo de vigília e sono.",
      },
    ],
  };
}
