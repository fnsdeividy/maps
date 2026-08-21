-- Um laudo por paciente e dia de exame: normaliza a data, remove duplicatas
-- (fica o mais recente) e impede novas cópias.

UPDATE "mapa_laudos"."MapaReport"
SET "examDate" = date_trunc('day', "examDate");

DELETE FROM "mapa_laudos"."MapaReport" AS report
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "patientId", "examDate"
      ORDER BY "createdAt" DESC
    ) AS rn
  FROM "mapa_laudos"."MapaReport"
) ranked
WHERE report.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "MapaReport_patientId_examDate_key"
  ON "mapa_laudos"."MapaReport"("patientId", "examDate");
