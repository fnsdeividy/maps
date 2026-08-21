import { prisma } from "@/lib/prisma";
import { guidelineFooter as defaultGuidelineFooter } from "@/domain/mapa/config/guideline";
import { mapaThresholds as defaultThresholds } from "@/domain/mapa/config/thresholds";
import {
  mapaThresholdsSchema,
  type ClinicSettingsData,
} from "./clinicSettingsSchema";

export async function getClinicSettings(): Promise<ClinicSettingsData> {
  const row = await prisma.clinicSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    return {
      thresholds: defaultThresholds,
      guidelineFooter: defaultGuidelineFooter,
    };
  }

  return {
    thresholds: mapaThresholdsSchema.parse(JSON.parse(row.thresholdsJson)),
    guidelineFooter: row.guidelineFooter,
  };
}

export async function saveClinicSettings(data: ClinicSettingsData): Promise<void> {
  const thresholds = mapaThresholdsSchema.parse(data.thresholds);

  await prisma.clinicSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      thresholdsJson: JSON.stringify(thresholds),
      guidelineFooter: data.guidelineFooter,
    },
    update: {
      thresholdsJson: JSON.stringify(thresholds),
      guidelineFooter: data.guidelineFooter,
    },
  });
}

export function countPendingSettings(thresholds: ClinicSettingsData["thresholds"]): number {
  return [
    thresholds.officeThresholds == null,
    thresholds.significantlyElevatedThresholds == null,
    thresholds.pressureLoadThresholds == null,
    thresholds.nightDippingThresholds == null,
    thresholds.technicalQualityThresholds == null,
    thresholds.pressurePeakThresholds == null,
  ].filter(Boolean).length;
}
