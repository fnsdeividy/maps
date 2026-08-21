-- Certificado digital A1 do médico e evidência de assinatura no laudo.

ALTER TABLE "mapa_laudos"."User"
ADD COLUMN "certificatePfx" BYTEA,
ADD COLUMN "certificateCommonName" TEXT,
ADD COLUMN "certificateIssuer" TEXT,
ADD COLUMN "certificateNotAfter" TIMESTAMP(3),
ADD COLUMN "certificateThumbprint" TEXT,
ADD COLUMN "certificateUploadedAt" TIMESTAMP(3);

ALTER TABLE "mapa_laudos"."MapaReport"
ADD COLUMN "signedAt" TIMESTAMP(3),
ADD COLUMN "signerCommonName" TEXT,
ADD COLUMN "signerThumbprint" TEXT,
ADD COLUMN "signatureHash" TEXT,
ADD COLUMN "signatureCms" TEXT;
