import { z } from "zod";
import type { MapaThresholds } from "@/domain/mapa/config/thresholds";

const pressurePairSchema = z.object({
  systolic: z.coerce.number().positive(),
  diastolic: z.coerce.number().positive(),
});

export const mapaThresholdsSchema = z.object({
  full24Hours: pressurePairSchema,
  awake: pressurePairSchema,
  sleep: pressurePairSchema,
  officeThresholds: pressurePairSchema.nullable(),
  significantlyElevatedThresholds: pressurePairSchema.nullable(),
  pressureLoadThresholds: z.preprocess(
    (value) => {
      if (value == null) return null;
      if (typeof value !== "object") return value;
      const record = value as Record<string, unknown>;
      if (
        record.awakeElevatedPercent != null &&
        record.sleepElevatedPercent != null
      ) {
        return {
          awakeElevatedPercent: record.awakeElevatedPercent,
          sleepElevatedPercent: record.sleepElevatedPercent,
        };
      }
      return {
        awakeElevatedPercent: 40,
        sleepElevatedPercent: 50,
      };
    },
    z
      .object({
        awakeElevatedPercent: z.coerce.number().min(0).max(100),
        sleepElevatedPercent: z.coerce.number().min(0).max(100),
      })
      .nullable(),
  ),
  nightDippingThresholds: z
    .object({
      absentMax: z.coerce.number(),
      attenuatedMax: z.coerce.number(),
      normalMax: z.coerce.number(),
    })
    .nullable(),
  technicalQualityThresholds: z
    .object({
      minValidPercentage: z.coerce.number().min(0).max(100),
    })
    .nullable(),
  pressurePeakThresholds: z.null(),
});

export type ClinicSettingsData = {
  thresholds: MapaThresholds;
  guidelineFooter: string;
};

function optionalPressurePair(
  enabled: boolean,
  systolic: FormDataEntryValue | null,
  diastolic: FormDataEntryValue | null,
) {
  if (!enabled) return null;
  return pressurePairSchema.parse({ systolic, diastolic });
}

export function parseSettingsForm(formData: FormData): ClinicSettingsData {
  const thresholds = mapaThresholdsSchema.parse({
    full24Hours: {
      systolic: formData.get("full24hSystolic"),
      diastolic: formData.get("full24hDiastolic"),
    },
    awake: {
      systolic: formData.get("awakeSystolic"),
      diastolic: formData.get("awakeDiastolic"),
    },
    sleep: {
      systolic: formData.get("sleepSystolic"),
      diastolic: formData.get("sleepDiastolic"),
    },
    officeThresholds: optionalPressurePair(
      formData.get("officeEnabled") === "on",
      formData.get("officeSystolic"),
      formData.get("officeDiastolic"),
    ),
    significantlyElevatedThresholds: optionalPressurePair(
      formData.get("significantlyElevatedEnabled") === "on",
      formData.get("significantlyElevatedSystolic"),
      formData.get("significantlyElevatedDiastolic"),
    ),
    pressureLoadThresholds:
      formData.get("pressureLoadEnabled") === "on"
        ? {
            awakeElevatedPercent: formData.get("pressureLoadAwakeElevatedPercent"),
            sleepElevatedPercent: formData.get("pressureLoadSleepElevatedPercent"),
          }
        : null,
    nightDippingThresholds:
      formData.get("nightDippingEnabled") === "on"
        ? {
            absentMax: formData.get("nightDippingAbsentMax"),
            attenuatedMax: formData.get("nightDippingAttenuatedMax"),
            normalMax: formData.get("nightDippingNormalMax"),
          }
        : null,
    technicalQualityThresholds:
      formData.get("technicalQualityEnabled") === "on"
        ? {
            minValidPercentage: formData.get("technicalQualityMinValidPercent"),
          }
        : null,
    pressurePeakThresholds: null,
  });

  const guidelineFooter = z.string().min(1).parse(String(formData.get("guidelineFooter") ?? ""));

  return { thresholds, guidelineFooter };
}
