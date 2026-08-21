import type { ParseConfidence } from "../types";
import type { AwpFieldName } from "./fields";

export type AwpHexFieldType =
  | "u8"
  | "u16le"
  | "u16be"
  | "bcd2"
  | "year_u16le"
  | "year_u16be";

export interface AwpHexField {
  name: Exclude<AwpFieldName, "datetime" | "ignored">;
  /** Deslocamento em bytes dentro do registro. */
  offset: number;
  type: AwpHexFieldType;
}

export interface AwpHexLayout {
  id: string;
  recordByteLength: number;
  fields: AwpHexField[];
  /** Ano/mês/dia/hora/minuto lidos como campos separados. */
  dateFields: {
    year: AwpHexField;
    month: AwpHexField;
    day: AwpHexField;
    hour: AwpHexField;
    minute: AwpHexField;
    second?: AwpHexField;
  };
  confidence: ParseConfidence;
  evidence: string[];
}

/**
 * Layouts binários confirmados, indexados pelo formatId do detector.
 *
 * ESTÁ VAZIO DE PROPÓSITO. Nenhum offset foi inventado: sem um arquivo .awp
 * real cujo resultado tenha sido comparado com o software oficial da CONTEC,
 * qualquer mapa de bytes aqui seria adivinhação, e adivinhar pressão arterial
 * é pior do que não interpretar.
 *
 * Enquanto isso, registros hexadecimais viram UNDECODED_RECORD e aparecem no
 * AWP Inspector (/dev/awp-inspector) com o hex viewer para engenharia reversa.
 *
 * Para registrar um layout depois de confirmá-lo em vários registros:
 *
 *   export const HEX_LAYOUTS = {
 *     "contec-abpm50-ini-v1.0": {
 *       id: "contec-awp-v1",
 *       recordByteLength: 12,
 *       fields: [
 *         { name: "systolic", offset: 8, type: "u8" },
 *         { name: "diastolic", offset: 9, type: "u8" },
 *         { name: "heartRate", offset: 10, type: "u8" },
 *       ],
 *       dateFields: {
 *         year: { name: "date", offset: 0, type: "year_u16be" },
 *         month: { name: "date", offset: 2, type: "u8" },
 *         ...
 *       },
 *       confidence: "VERIFIED",
 *       evidence: ["conferido contra exam-001 no software oficial"],
 *     },
 *   };
 */
export const HEX_LAYOUTS: Record<string, AwpHexLayout> = {};

export function findHexLayout(formatId: string): AwpHexLayout | undefined {
  return HEX_LAYOUTS[formatId];
}

export function readHexField(bytes: number[], field: AwpHexField): number | undefined {
  const { offset, type } = field;
  const first = bytes[offset];
  if (first === undefined) return undefined;

  switch (type) {
    case "u8":
      return first;
    case "bcd2":
      return (first >> 4) * 10 + (first & 0x0f);
    case "u16le":
    case "year_u16le": {
      const second = bytes[offset + 1];
      return second === undefined ? undefined : first | (second << 8);
    }
    case "u16be":
    case "year_u16be": {
      const second = bytes[offset + 1];
      return second === undefined ? undefined : (first << 8) | second;
    }
    default:
      return undefined;
  }
}
