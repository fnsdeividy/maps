import type { ParseWarning } from "../types";
import type {
  AwpDecodeInput,
  AwpMeasurementDecoder,
  DecodeOutcome,
  DecodedMeasurement,
} from "./AwpMeasurementDecoder";
import { buildDate, parseDateParts, parseTimeParts } from "./dateTime";
import { hasEnglishSystolicLabel, normalizeFieldName } from "./fields";

const PAIR = /([A-Za-z_][A-Za-z0-9_ ]*)\s*[:=]\s*([^,;|\t]+)/g;

function collectPairs(raw: string): Array<{ label: string; value: string }> {
  const pairs: Array<{ label: string; value: string }> = [];
  PAIR.lastIndex = 0;
  let match = PAIR.exec(raw);
  while (match) {
    pairs.push({ label: match[1].trim(), value: match[2].trim() });
    match = PAIR.exec(raw);
  }
  return pairs;
}

/**
 * Decodifica registros em que o próprio arquivo nomeia cada valor, por exemplo:
 *
 *   1=Date:2024-09-13,Time:08:30,SYS:127,DIA:70,PR:72
 *
 * Não há suposição de ordem nem de offset: cada número só é usado quando o
 * arquivo diz o que ele significa.
 */
export class LabeledFieldsMeasurementDecoder implements AwpMeasurementDecoder {
  readonly id = "labeled-fields";
  readonly confidence = "PARTIAL" as const;

  canDecode(input: AwpDecodeInput): boolean {
    const pairs = collectPairs(input.raw);
    if (pairs.length < 3) return false;
    const labels = pairs.map((pair) => pair.label);
    const preferEnglishDia = hasEnglishSystolicLabel(labels);
    const names = new Set(
      labels
        .map((label) => normalizeFieldName(label, { preferEnglishDia }))
        .filter(Boolean),
    );
    const hasMoment = names.has("datetime") || names.has("time") || names.has("date");
    return names.has("systolic") && names.has("diastolic") && hasMoment;
  }

  decode(input: AwpDecodeInput): DecodeOutcome {
    const warnings: ParseWarning[] = [];
    const pairs = collectPairs(input.raw);
    const preferEnglishDia = hasEnglishSystolicLabel(pairs.map((pair) => pair.label));

    const values = new Map<string, string>();
    for (const pair of pairs) {
      const name = normalizeFieldName(pair.label, { preferEnglishDia });
      if (!name) {
        warnings.push({
          code: "UNKNOWN_FIELD",
          message: `Campo não reconhecido no registro: ${pair.label}=${pair.value}`,
          recordIndex: input.index,
        });
        continue;
      }
      values.set(name, pair.value);
    }

    const dateToken = values.get("datetime") ?? values.get("date");
    const timeToken = values.get("time") ?? values.get("datetime");

    const measuredAt = this.resolveMoment(input, dateToken, timeToken);
    if (!measuredAt) {
      warnings.push({
        code: "INVALID_DATE",
        message: "Data ou horário do registro não pôde ser interpretado.",
        recordIndex: input.index,
      });
      return { status: "UNDECODED", warnings, note: "data/hora inválida" };
    }

    const systolic = Number(values.get("systolic"));
    const diastolic = Number(values.get("diastolic"));
    const heartRateRaw = values.get("heartRate");
    const mapRaw = values.get("meanArterialPressure");
    const errorCode = values.get("errorCode");

    if (heartRateRaw === undefined) {
      warnings.push({
        code: "MISSING_HEART_RATE",
        message: "Registro sem frequência cardíaca.",
        recordIndex: input.index,
      });
    }

    const measurement: DecodedMeasurement = {
      index: input.index,
      measuredAt,
      systolic,
      diastolic,
      heartRate: heartRateRaw === undefined ? undefined : Number(heartRateRaw),
      meanArterialPressure: mapRaw === undefined ? undefined : Number(mapRaw),
      errorCode: errorCode && errorCode !== "0" ? errorCode : undefined,
      rawRecord: input.raw,
    };

    return { status: "DECODED", measurement, warnings };
  }

  private resolveMoment(
    input: AwpDecodeInput,
    dateToken: string | undefined,
    timeToken: string | undefined,
  ): Date | undefined {
    const combined = [dateToken, timeToken].filter(Boolean).join(" ");
    const tokens = combined.split(/\s+/).filter(Boolean);
    const timePart = tokens.map(parseTimeParts).find(Boolean);
    if (!timePart) return undefined;

    const dateCandidate = tokens
      .map((token) => parseDateParts(token, input.context.dateOrder))
      .find(Boolean);
    const dateParts = dateCandidate ?? input.context.fallbackDate;
    if (!dateParts) return undefined;

    return buildDate(dateParts, timePart);
  }
}
