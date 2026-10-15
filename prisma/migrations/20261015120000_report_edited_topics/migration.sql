-- Tópicos editados à mão no laudo; o texto salvo prevalece sobre o recalculado.

ALTER TABLE "mapa_laudos"."MapaReport"
ADD COLUMN "editedTopics" TEXT NOT NULL DEFAULT '[]';
