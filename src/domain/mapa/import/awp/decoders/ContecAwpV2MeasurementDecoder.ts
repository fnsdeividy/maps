import type { ParseWarning } from "../types";
import type {
  AwpDecodeInput,
  AwpMeasurementDecoder,
  DecodeOutcome,
  DecodedMeasurement,
} from "./AwpMeasurementDecoder";
import { buildDate } from "./dateTime";
import { hexToBytes } from "./ContecAwpHexMeasurementDecoder";

const SUPPORTED_FORMAT = "contec-abpm50-ini-v2.0";
const MIN_RECORD_LENGTH = 30;
const HEX_RECORD = /^[0-9A-Fa-f]+$/;

export class InvalidHexValueError extends Error {
  constructor(readonly value: string) {
    super(`invalid_hex_value: ${value}`);
    this.name = "InvalidHexValueError";
  }
}

export class InvalidAwpMeasurementLengthError extends Error {
  constructor(readonly length: number) {
    super(`invalid_awp_measurement_length: ${length}`);
    this.name = "InvalidAwpMeasurementLengthError";
  }
}

export function parseHex(value: string): number {
  const result = Number.parseInt(value, 16);

  if (!Number.isFinite(result)) {
    throw new InvalidHexValueError(value);
  }

  return result;
}

/**
 * Decoder determinístico para registros hexadecimais textuais do AWP v2.0
 * (FileVersion_Main=2, FileVersion_Sub=0).
 *
 * Os offsets abaixo referem-se a posições na string hexadecimal textual do registro
 * (0-based em JavaScript; a documentação original usa 1-based).
 */
export class ContecAwpV2MeasurementDecoder implements AwpMeasurementDecoder {
  readonly id = "contec-awp-v2";
  readonly confidence = "PARTIAL" as const;

  canDecode(input: AwpDecodeInput): boolean {
    if (input.context.formatId !== SUPPORTED_FORMAT) return false;

    const raw = normalizeRaw(input.raw);
    return raw.length >= MIN_RECORD_LENGTH && HEX_RECORD.test(raw);
  }

  decode(input: AwpDecodeInput): DecodeOutcome {
    const raw = normalizeRaw(input.raw);
    const bytes = hexToBytes(raw);

    if (raw.length < MIN_RECORD_LENGTH) {
      return this.undecoded(input.index, "INVALID_MEASUREMENT_LENGTH", "INVALID_MEASUREMENT_LENGTH", bytes);
    }

    try {
      const year = parseHex(raw.slice(0, 4));
      const month = parseHex(raw.slice(4, 6));
      const day = parseHex(raw.slice(6, 8));
      const hour = parseHex(raw.slice(8, 10));
      const minute = parseHex(raw.slice(10, 12));
      const systolic = parseHex(raw.slice(16, 18));
      const diastolic = parseHex(raw.slice(20, 22));
      const meanArterialPressure = parseHex(raw.slice(24, 26));
      const heartRate = parseHex(raw.slice(28, 30));
      const rawTail = raw.slice(30);

      const measuredAt = buildDate({ year, month, day }, { hour, minute, second: 0 });
      if (!measuredAt) {
        return this.undecoded(input.index, "INVALID_DATE", "INVALID_DATE", bytes);
      }

      const measurement: DecodedMeasurement = {
        index: input.index,
        measuredAt,
        systolic,
        diastolic,
        meanArterialPressure,
        heartRate,
        rawRecord: input.raw,
        rawTail,
      };

      return { status: "DECODED", measurement, warnings: [] };
    } catch (error) {
      if (error instanceof InvalidHexValueError) {
        return this.undecoded(
          input.index,
          "UNDECODED_RECORD",
          `hex inválido: ${error.value}`,
          bytes,
        );
      }
      throw error;
    }
  }

  private undecoded(
    recordIndex: number,
    code: ParseWarning["code"],
    note: string,
    bytes?: number[],
  ): DecodeOutcome {
    return {
      status: "UNDECODED",
      warnings: [
        {
          code,
          message: note,
          recordIndex,
        },
      ],
      note,
      bytes,
    };
  }
}

function normalizeRaw(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
