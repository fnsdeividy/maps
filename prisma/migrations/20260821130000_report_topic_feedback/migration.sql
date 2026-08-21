-- AlterTable
ALTER TABLE "mapa_laudos"."MapaReport"
  ADD COLUMN "reviewNotesByTopic" TEXT NOT NULL DEFAULT '{}';
