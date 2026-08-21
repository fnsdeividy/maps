import { z } from "zod";

/** Resposta parcial: só seções reescritas pela IA. */
export const aiMapaReportPartialSchema = z.object({
  technicalComments: z.string().optional(),
  averagePressure: z.string().optional(),
  pressureLoad: z.string().optional(),
  pressurePeaks: z.string().optional(),
  nightDipping: z.string().optional(),
  specialSituations: z.string().optional(),
  generalConsiderations: z.string().optional(),
});

export type AiMapaReportPartial = z.infer<typeof aiMapaReportPartialSchema>;

/** Schema completo (compatível com o validador). */
export const aiMapaReportResponseSchema = z.object({
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

export type AiMapaReportResponse = z.infer<typeof aiMapaReportResponseSchema>;
