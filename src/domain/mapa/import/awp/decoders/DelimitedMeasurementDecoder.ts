import type { ParseWarning } from "../types";
import type {
  AwpDecodeInput,
  AwpMeasurementDecoder,
  DecodeOutcome,
  DecodedMeasurement,
} from "./AwpMeasurementDecoder";
import { buildDate, parseDateParts, parseTimeParts } from "./dateTime";
import type { AwpFieldName } from "./fields";

export const DELIMITER = /[,;|\t]+/;

/**
 * Decodifica registros delimitados quando — e somente quando — o arquivo
 * declara a ordem dos campos em um metadado (`DataFormat=`, `RecordFormat=`,
 * `Fields=`, `Columns=`). Sem essa declaração o decoder se recusa a atuar,
 * porque associar números a PAS/PAD por posição adivinhada seria inventar dado
 * clínico.
 */
export class DelimitedMeasurementDecoder implements AwpMeasurementDecoder {
  readonly id = "declared-delimited";
  readonly confidence = "PARTIAL" as const;

  canDecode(input: AwpDecodeInput): boolean {
    const order = input.context.fieldOrder;
    if (!order || order.length === 0) return false;
    if (!order.includes("systolic") || !order.includes("diastolic")) return false;
    const columns = input.raw.split(DELIMITER);
    return columns.length >= order.filter((field) => field !== "ignored").length;
  }

  decode(input: AwpDecodeInput): DecodeOutcome {
    const warnings: ParseWarning[] = [];
    const order = input.context.fieldOrder ?? [];
    const columns = input.raw.split(DELIMITER).map((column) => column.trim());

    const values = new Map<AwpFieldName, string>();
    order.forEach((field, position) => {
      if (field === "ignored") return;
      const value = columns[position];
      if (value === undefined) return;
      values.set(field, value);
    });

    const measuredAt = this.resolveMoment(input, values);
    if (!measuredAt) {
      warnings.push({
        code: "INVALID_DATE",
        message: "Data ou horário do registro não pôde ser interpretado.",
        recordIndex: input.index,
      });
      return { status: "UNDECODED", warnings, note: "data/hora inválida" };
    }

    const heartRateRaw = values.get("heartRate");
    if (heartRateRaw === undefined || heartRateRaw === "") {
      warnings.push({
        code: "MISSING_HEART_RATE",
        message: "Registro sem frequência cardíaca.",
        recordIndex: input.index,
      });
    }

    const mapRaw = values.get("meanArterialPressure");
    const errorCode = values.get("errorCode");

    const measurement: DecodedMeasurement = {
      index: input.index,
      measuredAt,
      systolic: Number(values.get("systolic")),
      diastolic: Number(values.get("diastolic")),
      heartRate: heartRateRaw ? Number(heartRateRaw) : undefined,
      meanArterialPressure: mapRaw ? Number(mapRaw) : undefined,
      errorCode: errorCode && errorCode !== "0" ? errorCode : undefined,
      rawRecord: input.raw,
    };

    return { status: "DECODED", measurement, warnings };
  }

  private resolveMoment(
    input: AwpDecodeInput,
    values: Map<AwpFieldName, string>,
  ): Date | undefined {
    const tokens = [values.get("datetime"), values.get("date"), values.get("time")]
      .filter((token): token is string => Boolean(token))
      .flatMap((token) => token.split(/\s+/));

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
