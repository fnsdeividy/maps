import { z } from "zod";

export const patientSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().min(1),
  gender: z.enum(["M", "F", "OTHER"]),
  document: z.string().optional(),
  notes: z.string().optional(),
});

export const specialSituationSchema = z.enum([
  "PREGNANT",
  "ALCOHOL",
  "SMOKING",
  "INSOMNIA",
  "CAFFEINE",
  "ORTHOSTATIC",
  "NAP",
  "POSTPRANDIAL",
  "BISOPROLOL",
  "OFFICE_HIGH_BP",
]);

const triStateSchema = z.enum(["YES", "NO", "UNKNOWN"]);

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}, z.number().nullable());

export const reportInputSchema = z.object({
  patientId: z.string().min(1),
  examDate: z.string().min(1),
  currentMedications: z.string().optional().default(""),
  officeSystolicPressure: optionalNumber,
  officeDiastolicPressure: optionalNumber,
  officeHeartRate: optionalNumber,
  pregnancy: z.boolean().optional().default(false),
  pregnancyMonths: optionalNumber,
  pregnancyStatus: triStateSchema,
  alcoholUse: triStateSchema,
  smoking: triStateSchema,
  insomnia: triStateSchema,
  caffeineUse: triStateSchema,
  totalMeasurements: optionalNumber,
  validMeasurements: optionalNumber,
  technicalComments: z.string().optional(),
  avg24hSystolic: optionalNumber,
  avg24hDiastolic: optionalNumber,
  awakeSystolic: optionalNumber,
  awakeDiastolic: optionalNumber,
  sleepSystolic: optionalNumber,
  sleepDiastolic: optionalNumber,
  awakeSystolicLoad: optionalNumber,
  awakeDiastolicLoad: optionalNumber,
  sleepSystolicLoad: optionalNumber,
  sleepDiastolicLoad: optionalNumber,
  systolicNightDipping: optionalNumber,
  diastolicNightDipping: optionalNumber,
  peakAwake: z.boolean().optional().default(false),
  peakSleep: z.boolean().optional().default(false),
  peakMorning: z.boolean().optional().default(false),
  peakWithHeartRateIncrease: z.boolean().optional().default(false),
  peakPhysicalEmotionalStress: z.boolean().optional().default(false),
  peakPressureNotes: z.string().optional(),
  specialSituations: z.array(specialSituationSchema).optional().default([]),
});

export const reportSectionsSchema = z.object({
  medications: z.string(),
  technicalComments: z.string(),
  averagePressure: z.string(),
  pressureLoad: z.string(),
  pressurePeaks: z.string(),
  nightDipping: z.string(),
  specialSituations: z.string(),
  generalConsiderations: z.string(),
  conclusion: z.string(),
});
