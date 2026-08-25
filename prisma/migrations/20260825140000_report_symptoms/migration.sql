-- Sintomas clínicos no laudo (dores de cabeça, peito, falta de ar, tontura).

ALTER TABLE "mapa_laudos"."MapaReport"
ADD COLUMN "headache" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "chestPain" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "dyspnea" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "dizziness" TEXT NOT NULL DEFAULT 'UNKNOWN';
