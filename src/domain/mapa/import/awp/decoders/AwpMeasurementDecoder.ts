import type { MapaMeasurement, ParseConfidence, ParseWarning } from "../types";
import type { AwpFieldName } from "./fields";
import type { DateOrder } from "./dateTime";
import type { AwpHexLayout } from "./hexLayouts";

/** Medição antes da validação estrutural: `valid` ainda não foi decidido. */
export type DecodedMeasurement = Omit<MapaMeasurement, "valid" | "invalidReason"> & {
  /** Bytes finais do registro hex cujo significado ainda não está confirmado. */
  rawTail?: string;
};

export interface AwpDecodeContext {
  /** formatId detectado pelo AwpFormatDetector (ex.: contec-abpm50-ini-v2.0). */
  formatId?: string;
  /** Ordem de campos declarada pelo próprio arquivo, quando existir. */
  fieldOrder?: AwpFieldName[];
  dateOrder?: DateOrder;
  /** Data declarada em metadado, usada quando o registro traz apenas horário. */
  fallbackDate?: { year: number; month: number; day: number };
  /** Falso quando nenhum registro traz data própria. */
  recordsCarryOwnDate?: boolean;
  /** Layout hexadecimal confirmado para o formato detectado, se houver. */
  hexLayout?: AwpHexLayout;
}

export interface AwpDecodeInput {
  index: number;
  key: string;
  raw: string;
  context: AwpDecodeContext;
}

export type DecodeOutcome =
  | { status: "DECODED"; measurement: DecodedMeasurement; warnings: ParseWarning[] }
  | { status: "UNDECODED"; warnings: ParseWarning[]; note?: string; bytes?: number[] };

export interface AwpMeasurementDecoder {
  readonly id: string;
  /** Confiança máxima que este decoder pode conferir ao resultado. */
  readonly confidence: ParseConfidence;
  canDecode(input: AwpDecodeInput): boolean;
  decode(input: AwpDecodeInput): DecodeOutcome;
}
