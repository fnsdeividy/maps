-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "mapa_laudos";

-- CreateTable
CREATE TABLE "mapa_laudos"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DOCTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."Patient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "document" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."MapaReport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "currentMedications" TEXT NOT NULL DEFAULT '',
    "officeSystolicPressure" DOUBLE PRECISION,
    "officeDiastolicPressure" DOUBLE PRECISION,
    "officeHeartRate" DOUBLE PRECISION,
    "pregnancy" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyMonths" INTEGER,
    "pregnancyStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "alcoholUse" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "smoking" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "insomnia" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caffeineUse" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "totalMeasurements" INTEGER,
    "validMeasurements" INTEGER,
    "validMeasurementsPercentage" DOUBLE PRECISION,
    "technicalComments" TEXT,
    "avg24hSystolic" DOUBLE PRECISION,
    "avg24hDiastolic" DOUBLE PRECISION,
    "awakeSystolic" DOUBLE PRECISION,
    "awakeDiastolic" DOUBLE PRECISION,
    "sleepSystolic" DOUBLE PRECISION,
    "sleepDiastolic" DOUBLE PRECISION,
    "awakeSystolicLoad" DOUBLE PRECISION,
    "awakeDiastolicLoad" DOUBLE PRECISION,
    "sleepSystolicLoad" DOUBLE PRECISION,
    "sleepDiastolicLoad" DOUBLE PRECISION,
    "systolicNightDipping" DOUBLE PRECISION,
    "diastolicNightDipping" DOUBLE PRECISION,
    "peakAwake" BOOLEAN NOT NULL DEFAULT false,
    "peakSleep" BOOLEAN NOT NULL DEFAULT false,
    "peakMorning" BOOLEAN NOT NULL DEFAULT false,
    "peakWithHeartRateIncrease" BOOLEAN NOT NULL DEFAULT false,
    "peakPhysicalEmotionalStress" BOOLEAN NOT NULL DEFAULT false,
    "peakPressureNotes" TEXT,
    "specialSituations" TEXT NOT NULL DEFAULT '[]',
    "generatedMedications" TEXT,
    "generatedTechnicalComments" TEXT,
    "generatedResults" TEXT,
    "generatedPressureLoad" TEXT,
    "generatedPressurePeaks" TEXT,
    "generatedNightDipping" TEXT,
    "generatedSpecialSituations" TEXT,
    "generatedGeneralConsiderations" TEXT,
    "generatedConclusion" TEXT,
    "usedAiFallback" BOOLEAN NOT NULL DEFAULT false,
    "includeTrendChart" BOOLEAN NOT NULL DEFAULT true,
    "includeHistogramChart" BOOLEAN NOT NULL DEFAULT true,
    "includePieChart" BOOLEAN NOT NULL DEFAULT true,
    "assistantDoctorName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapaReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."MapaSourceFile" (
    "id" TEXT NOT NULL,
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
    "content" BYTEA NOT NULL,
    "sleepStart" TEXT,
    "sleepEnd" TEXT,
    "sleepSource" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapaSourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."ReportPhrase" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReportPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."AiUsage" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedInputCost" DOUBLE PRECISION NOT NULL,
    "estimatedOutputCost" DOUBLE PRECISION NOT NULL,
    "estimatedTotalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."ReportGenerationLog" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_laudos"."ClinicSettings" (
    "id" TEXT NOT NULL,
    "thresholdsJson" TEXT NOT NULL,
    "guidelineFooter" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "mapa_laudos"."User"("email");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "mapa_laudos"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "mapa_laudos"."Notification"("createdAt");

-- CreateIndex
CREATE INDEX "MapaReport_patientId_idx" ON "mapa_laudos"."MapaReport"("patientId");

-- CreateIndex
CREATE INDEX "MapaReport_status_idx" ON "mapa_laudos"."MapaReport"("status");

-- CreateIndex
CREATE INDEX "MapaReport_createdAt_idx" ON "mapa_laudos"."MapaReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MapaSourceFile_reportId_key" ON "mapa_laudos"."MapaSourceFile"("reportId");

-- CreateIndex
CREATE INDEX "MapaSourceFile_patientId_idx" ON "mapa_laudos"."MapaSourceFile"("patientId");

-- CreateIndex
CREATE INDEX "MapaSourceFile_fileHash_idx" ON "mapa_laudos"."MapaSourceFile"("fileHash");

-- CreateIndex
CREATE INDEX "MapaSourceFile_createdAt_idx" ON "mapa_laudos"."MapaSourceFile"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportPhrase_code_key" ON "mapa_laudos"."ReportPhrase"("code");

-- CreateIndex
CREATE INDEX "AiUsage_reportId_idx" ON "mapa_laudos"."AiUsage"("reportId");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "mapa_laudos"."AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "ReportGenerationLog_reportId_idx" ON "mapa_laudos"."ReportGenerationLog"("reportId");

-- CreateIndex
CREATE INDEX "ReportGenerationLog_createdAt_idx" ON "mapa_laudos"."ReportGenerationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "mapa_laudos"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "mapa_laudos"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_laudos"."MapaReport" ADD CONSTRAINT "MapaReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "mapa_laudos"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_laudos"."MapaReport" ADD CONSTRAINT "MapaReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "mapa_laudos"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_laudos"."MapaSourceFile" ADD CONSTRAINT "MapaSourceFile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "mapa_laudos"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_laudos"."MapaSourceFile" ADD CONSTRAINT "MapaSourceFile_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "mapa_laudos"."MapaReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_laudos"."AiUsage" ADD CONSTRAINT "AiUsage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "mapa_laudos"."MapaReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_laudos"."ReportGenerationLog" ADD CONSTRAINT "ReportGenerationLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "mapa_laudos"."MapaReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
