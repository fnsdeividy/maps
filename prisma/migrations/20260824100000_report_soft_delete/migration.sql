-- AlterTable: soft-delete flag para MapaReport
ALTER TABLE "mapa_laudos"."MapaReport" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
