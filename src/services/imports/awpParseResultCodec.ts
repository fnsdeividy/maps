import type { MapaFileParseResult } from "@/domain/mapa/import/awp/types";
import { fromStoredDateTime, toStoredDateTime } from "@/lib/dates";

/**
 * O resultado do parser é guardado em JSON entre a análise e a confirmação.
 * Datas AWP viajam como wall-clock ("2026-08-17T08:35:00"), sem Z/offset.
 */
export function serializeParseResult(result: MapaFileParseResult): string {
  return JSON.stringify(result, (_key, value) => {
    if (value instanceof Date) return toStoredDateTime(value);
    return value;
  });
}

type Serialized = Omit<
  MapaFileParseResult,
  | "examStart"
  | "examEnd"
  | "deviceSetupStartedAt"
  | "measurementStartedAt"
  | "measurements"
  | "patientData"
> & {
  examStart?: string;
  examEnd?: string;
  deviceSetupStartedAt?: string;
  measurementStartedAt?: string;
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
    examStart: raw.examStart ? fromStoredDateTime(raw.examStart) : undefined,
    examEnd: raw.examEnd ? fromStoredDateTime(raw.examEnd) : undefined,
    deviceSetupStartedAt: raw.deviceSetupStartedAt
      ? fromStoredDateTime(raw.deviceSetupStartedAt)
      : undefined,
    measurementStartedAt: raw.measurementStartedAt
      ? fromStoredDateTime(raw.measurementStartedAt)
      : undefined,
    patientData: raw.patientData
      ? {
          ...raw.patientData,
          birthday: raw.patientData.birthday
            ? fromStoredDateTime(
                raw.patientData.birthday.includes("T")
                  ? raw.patientData.birthday
                  : `${raw.patientData.birthday.slice(0, 10)}T00:00:00`,
              )
            : undefined,
        }
      : undefined,
    measurements: raw.measurements.map((measurement) => ({
      ...measurement,
      measuredAt: fromStoredDateTime(measurement.measuredAt),
    })),
  };
}
