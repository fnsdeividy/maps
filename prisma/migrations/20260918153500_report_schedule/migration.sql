ALTER TABLE "mapa_laudos"."MapaReport"
  ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MapaReport_scheduledAt_key"
  ON "mapa_laudos"."MapaReport"("scheduledAt");
