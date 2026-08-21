import { ContecAwpHexMeasurementDecoder } from "./ContecAwpHexMeasurementDecoder";
import { ContecAwpV2MeasurementDecoder } from "./ContecAwpV2MeasurementDecoder";
import { DelimitedMeasurementDecoder } from "./DelimitedMeasurementDecoder";
import { LabeledFieldsMeasurementDecoder } from "./LabeledFieldsMeasurementDecoder";
import type { AwpMeasurementDecoder } from "./AwpMeasurementDecoder";

/**
 * Ordem de tentativa: do mais explícito (o arquivo nomeia cada campo) para o
 * menos explícito (bytes crus). O primeiro decoder que reconhece o registro
 * assume a decodificação.
 */
export function buildDecoderChain(): AwpMeasurementDecoder[] {
  return [
    new LabeledFieldsMeasurementDecoder(),
    new DelimitedMeasurementDecoder(),
    new ContecAwpV2MeasurementDecoder(),
    new ContecAwpHexMeasurementDecoder(),
  ];
}

export {
  ContecAwpHexMeasurementDecoder,
  ContecAwpV2MeasurementDecoder,
  DelimitedMeasurementDecoder,
  LabeledFieldsMeasurementDecoder,
};
export type { AwpMeasurementDecoder };
