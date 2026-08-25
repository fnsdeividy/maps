-- Tag de medicação cardiovascular (anti-hipertensivo) no laudo.

ALTER TABLE "mapa_laudos"."MapaReport"
ADD COLUMN "cvMedicationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN';
