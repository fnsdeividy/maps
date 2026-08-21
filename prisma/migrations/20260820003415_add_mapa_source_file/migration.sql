-- CreateTable
CREATE TABLE "MapaSourceFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT,
    "reportId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ANALYZED',
    "manufacturer" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "encoding" TEXT NOT NULL,
    "detectedFormat" TEXT NOT NULL,
    "detectedVersion" TEXT,
    "parserVersion" TEXT NOT NULL,
    "parseConfidence" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "validMeasurements" INTEGER NOT NULL,
    "invalidMeasurements" INTEGER NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "payloadJson" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "sleepStart" TEXT,
    "sleepEnd" TEXT,
    "sleepSource" TEXT,
    "importedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MapaSourceFile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MapaSourceFile_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MapaReport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MapaSourceFile_reportId_key" ON "MapaSourceFile"("reportId");

-- CreateIndex
CREATE INDEX "MapaSourceFile_patientId_idx" ON "MapaSourceFile"("patientId");

-- CreateIndex
CREATE INDEX "MapaSourceFile_fileHash_idx" ON "MapaSourceFile"("fileHash");

-- CreateIndex
CREATE INDEX "MapaSourceFile_createdAt_idx" ON "MapaSourceFile"("createdAt");
