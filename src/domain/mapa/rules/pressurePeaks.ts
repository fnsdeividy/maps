import { formatTime } from "@/lib/dates";
import {
  isWithinSleepWindow,
  type SleepWindowInput,
} from "@/domain/mapa/services/MapaMetricsCalculator";

type PeakMeasurement = {
  measuredAt: Date;
  systolic: number;
  diastolic: number;
  valid: boolean;
  observation?: string | null;
};

function associatedSymptom(observation?: string | null): string {
  const text = observation?.trim();
  return text ? `${text} (sic)` : "não relatado (sic)";
}

function maxBy<T>(items: T[], value: (item: T) => number): T {
  return items.reduce((max, item) => (value(item) > value(max) ? item : max));
}

function periodPeakLines(
  measurements: PeakMeasurement[],
  period: "awake" | "sleep",
): string[] {
  const sysPeak = maxBy(measurements, (item) => item.systolic);
  const diaPeak = maxBy(measurements, (item) => item.diastolic);
  const sysPlace = period === "awake" ? "na vigília ocorreu" : "no sono ocorreu";
  const diaPlace =
    period === "awake" ? "na vigília, ocorrido" : "no sono ocorrido";

  return [
    `Maior valor pressórico sistólico (${sysPeak.systolic}mmHg) ${sysPlace} às ${formatTime(sysPeak.measuredAt)}h.`,
    `Sintoma associado: ${associatedSymptom(sysPeak.observation)}`,
    `Maior valor pressórico diastólico (${diaPeak.diastolic}mmHg) ${diaPlace} às ${formatTime(diaPeak.measuredAt)}h.`,
    `Sintoma associado: ${associatedSymptom(diaPeak.observation)}`,
  ];
}

/**
 * Picos no formato do roteiro clínico, a partir das medições válidas.
 * Sem medições, devolve vazio para o motor usar as frases manuais.
 */
export function buildOfficialPeakNarrative(
  measurements: PeakMeasurement[],
  sleepWindow: SleepWindowInput | null,
): string {
  const valid = measurements.filter((item) => item.valid);
  if (valid.length === 0) return "";

  const asleep = (item: PeakMeasurement) =>
    sleepWindow
      ? isWithinSleepWindow(item.measuredAt, sleepWindow) === true
      : false;

  const awake = sleepWindow ? valid.filter((item) => !asleep(item)) : valid;
  const sleep = sleepWindow ? valid.filter((item) => asleep(item)) : [];

  const lines: string[] = [];
  if (awake.length > 0) {
    lines.push(...periodPeakLines(awake, "awake"));
  }
  if (sleep.length > 0) {
    lines.push("Maiores valores pressóricos registrados durante o Sono.");
    lines.push(...periodPeakLines(sleep, "sleep"));
  }

  return lines.join("\n");
}

const PEAK_FLAG_PHRASES = [
  {
    text: "Concomitante aumento da frequência cardíaca.",
    aliases: ["Concomitante aumento da frequência cardíaca."],
  },
  {
    text: "Relato de estresse físico-emocional neste momento.",
    aliases: ["Relato de estresse físico-emocional neste momento."],
  },
  {
    text: "Maior valor pressórico matutino, ao acordar.",
    aliases: [
      "Maior valor pressórico matutino, ao acordar.",
      "Pico pressórico matutino, ao acordar.",
    ],
  },
] as const;

/** Mantém só as frases de flag manual ao substituir o bloco pelos valores medidos. */
export function peakFlagPhrasesFrom(text: string): string[] {
  return PEAK_FLAG_PHRASES.filter((phrase) =>
    phrase.aliases.some((alias) => text.includes(alias)),
  ).map((phrase) => phrase.text);
}

/** Atualiza a nomenclatura de textos antigos já armazenados no banco. */
export function normalizePressurePeakTerminology(text: string): string {
  return text
    .replace(/Picos pressóricos/gi, "Maiores valores pressóricos registrados")
    .replace(/Pico pressórico/gi, "Maior valor pressórico");
}
