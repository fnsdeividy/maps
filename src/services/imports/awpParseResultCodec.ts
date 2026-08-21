import type { MapaFileParseResult } from "@/domain/mapa/import/awp/types";

/**
 * O resultado do parser é guardado em JSON para sobreviver entre a análise e a
 * confirmação da importação, sem pedir o arquivo novamente ao usuário.
 * Datas viajam em ISO e são revividas na leitura.
 */
export function serializeParseResult(result: MapaFileParseResult): string {
  return JSON.stringify(result);
}

type Serialized = Omit<
  MapaFileParseResult,
  "examStart" | "examEnd" | "measurements" | "patientData"
> & {
  examStart?: string;
  examEnd?: string;
  measurements: Array<
    Omit<MapaFileParseResult["measurements"][number], "measuredAt"> & { measuredAt: string }
  >;
  patientData?: Omit<NonNullable<MapaFileParseResult["patientData"]>, "birthday"> & {
    birthday?: string;
  };
};

export function deserializeParseResult(payload: string): MapaFileParseResult {
  const raw = JSON.parse(payload) as Serialized;

  return {
    ...raw,
    examStart: raw.examStart ? new Date(raw.examStart) : undefined,
    examEnd: raw.examEnd ? new Date(raw.examEnd) : undefined,
    patientData: raw.patientData
      ? {
          ...raw.patientData,
          birthday: raw.patientData.birthday
            ? new Date(raw.patientData.birthday)
            : undefined,
        }
      : undefined,
    measurements: raw.measurements.map((measurement) => ({
      ...measurement,
      measuredAt: new Date(measurement.measuredAt),
    })),
  };
}
