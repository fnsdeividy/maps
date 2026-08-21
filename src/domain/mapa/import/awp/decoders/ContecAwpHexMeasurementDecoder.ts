import type { ParseWarning } from "../types";
import type {
  AwpDecodeInput,
  AwpMeasurementDecoder,
  DecodeOutcome,
  DecodedMeasurement,
} from "./AwpMeasurementDecoder";
import { buildDate } from "./dateTime";
import { readHexField, type AwpHexLayout } from "./hexLayouts";

const HEX_RECORD = /^[0-9A-Fa-f]+$/;

export function hexToBytes(raw: string): number[] {
  const clean = raw.replace(/\s+/g, "");
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes.push(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Todo o conhecimento sobre a estrutura binária dos registros fica concentrado
 * aqui e no mapa declarativo `AwpHexLayout` — nenhum offset é espalhado pelo
 * resto do código.
 *
 * Sem layout registrado para o formato detectado o decoder devolve
 * UNDECODED_RECORD com os bytes preservados, em vez de interpretar por
 * aproximação. Versões futuras (v2, v3...) são adicionadas registrando outro
 * layout, sem alterar esta classe.
 */
export class ContecAwpHexMeasurementDecoder implements AwpMeasurementDecoder {
  readonly id = "contec-hex";
  readonly confidence = "PARTIAL" as const;

  canDecode(input: AwpDecodeInput): boolean {
    const clean = input.raw.replace(/\s+/g, "");
    return clean.length >= 8 && clean.length % 2 === 0 && HEX_RECORD.test(clean);
  }

  decode(input: AwpDecodeInput): DecodeOutcome {
    const bytes = hexToBytes(input.raw);
    const layout = input.context.hexLayout;

    if (!layout) {
      const warnings: ParseWarning[] = [
        {
          code: "MISSING_HEX_LAYOUT",
          message:
            "Registro hexadecimal reconhecido, mas não há layout de bytes confirmado para esta versão do arquivo.",
          recordIndex: input.index,
        },
        {
          code: "UNDECODED_RECORD",
          message: "Registro preservado sem interpretação.",
          recordIndex: input.index,
        },
      ];
      return {
        status: "UNDECODED",
        warnings,
        note: "layout de bytes não confirmado",
        bytes,
      };
    }

    if (bytes.length < layout.recordByteLength) {
      return {
        status: "UNDECODED",
        warnings: [
          {
            code: "UNDECODED_RECORD",
            message: `Registro com ${bytes.length} bytes, abaixo dos ${layout.recordByteLength} esperados pelo layout ${layout.id}.`,
            recordIndex: input.index,
          },
        ],
        note: "registro menor que o layout",
        bytes,
      };
    }

    const measuredAt = this.readDate(bytes, layout);
    if (!measuredAt) {
      return {
        status: "UNDECODED",
        warnings: [
          {
            code: "INVALID_DATE",
            message: "Data/hora fora de faixa válida no registro binário.",
            recordIndex: input.index,
          },
        ],
        note: "data/hora inválida",
        bytes,
      };
    }

    const warnings: ParseWarning[] = [];
    const read = (name: string) => {
      const field = layout.fields.find((item) => item.name === name);
      return field ? readHexField(bytes, field) : undefined;
    };

    const heartRate = read("heartRate");
    if (heartRate === undefined) {
      warnings.push({
        code: "MISSING_HEART_RATE",
        message: "Registro sem frequência cardíaca.",
        recordIndex: input.index,
      });
    }

    const errorCode = read("errorCode");

    const measurement: DecodedMeasurement = {
      index: input.index,
      measuredAt,
      systolic: read("systolic") ?? Number.NaN,
      diastolic: read("diastolic") ?? Number.NaN,
      heartRate,
      meanArterialPressure: read("meanArterialPressure"),
      errorCode: errorCode ? String(errorCode) : undefined,
      rawRecord: input.raw,
    };

    return { status: "DECODED", measurement, warnings };
  }

  private readDate(bytes: number[], layout: AwpHexLayout): Date | undefined {
    const { year, month, day, hour, minute, second } = layout.dateFields;
    const parts = {
      year: readHexField(bytes, year),
      month: readHexField(bytes, month),
      day: readHexField(bytes, day),
      hour: readHexField(bytes, hour),
      minute: readHexField(bytes, minute),
      second: second ? readHexField(bytes, second) : 0,
    };

    if (
      parts.year === undefined ||
      parts.month === undefined ||
      parts.day === undefined ||
      parts.hour === undefined ||
      parts.minute === undefined
    ) {
      return undefined;
    }

    return buildDate(
      { year: parts.year, month: parts.month, day: parts.day },
      { hour: parts.hour, minute: parts.minute, second: parts.second ?? 0 },
    );
  }
}
