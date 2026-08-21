-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DOCTOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "document" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MapaReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "examDate" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentMedications" TEXT NOT NULL DEFAULT '',
    "officeSystolicPressure" REAL,
    "officeDiastolicPressure" REAL,
    "officeHeartRate" REAL,
    "pregnancy" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyMonths" INTEGER,
    "totalMeasurements" INTEGER,
    "validMeasurements" INTEGER,
    "validMeasurementsPercentage" REAL,
    "technicalComments" TEXT,
    "avg24hSystolic" REAL,
    "avg24hDiastolic" REAL,
    "awakeSystolic" REAL,
    "awakeDiastolic" REAL,
    "sleepSystolic" REAL,
    "sleepDiastolic" REAL,
    "awakeSystolicLoad" REAL,
    "awakeDiastolicLoad" REAL,
    "sleepSystolicLoad" REAL,
    "sleepDiastolicLoad" REAL,
    "systolicNightDipping" REAL,
    "diastolicNightDipping" REAL,
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
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MapaReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportPhrase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedInputCost" REAL NOT NULL,
    "estimatedOutputCost" REAL NOT NULL,
    "estimatedTotalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MapaReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportGenerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportGenerationLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MapaReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "MapaReport_patientId_idx" ON "MapaReport"("patientId");

-- CreateIndex
CREATE INDEX "MapaReport_status_idx" ON "MapaReport"("status");

-- CreateIndex
CREATE INDEX "MapaReport_createdAt_idx" ON "MapaReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportPhrase_code_key" ON "ReportPhrase"("code");

-- CreateIndex
CREATE INDEX "AiUsage_reportId_idx" ON "AiUsage"("reportId");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "ReportGenerationLog_reportId_idx" ON "ReportGenerationLog"("reportId");

-- CreateIndex
CREATE INDEX "ReportGenerationLog_createdAt_idx" ON "ReportGenerationLog"("createdAt");
