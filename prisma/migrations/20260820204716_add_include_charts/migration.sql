-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MapaReport" (
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
    "includeCharts" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MapaReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MapaReport" ("approvedAt", "avg24hDiastolic", "avg24hSystolic", "awakeDiastolic", "awakeDiastolicLoad", "awakeSystolic", "awakeSystolicLoad", "createdAt", "currentMedications", "diastolicNightDipping", "examDate", "generatedConclusion", "generatedGeneralConsiderations", "generatedMedications", "generatedNightDipping", "generatedPressureLoad", "generatedPressurePeaks", "generatedResults", "generatedSpecialSituations", "generatedTechnicalComments", "id", "officeDiastolicPressure", "officeHeartRate", "officeSystolicPressure", "patientId", "peakAwake", "peakMorning", "peakPhysicalEmotionalStress", "peakPressureNotes", "peakSleep", "peakWithHeartRateIncrease", "pregnancy", "pregnancyMonths", "sleepDiastolic", "sleepDiastolicLoad", "sleepSystolic", "sleepSystolicLoad", "source", "specialSituations", "status", "systolicNightDipping", "technicalComments", "totalMeasurements", "updatedAt", "usedAiFallback", "validMeasurements", "validMeasurementsPercentage") SELECT "approvedAt", "avg24hDiastolic", "avg24hSystolic", "awakeDiastolic", "awakeDiastolicLoad", "awakeSystolic", "awakeSystolicLoad", "createdAt", "currentMedications", "diastolicNightDipping", "examDate", "generatedConclusion", "generatedGeneralConsiderations", "generatedMedications", "generatedNightDipping", "generatedPressureLoad", "generatedPressurePeaks", "generatedResults", "generatedSpecialSituations", "generatedTechnicalComments", "id", "officeDiastolicPressure", "officeHeartRate", "officeSystolicPressure", "patientId", "peakAwake", "peakMorning", "peakPhysicalEmotionalStress", "peakPressureNotes", "peakSleep", "peakWithHeartRateIncrease", "pregnancy", "pregnancyMonths", "sleepDiastolic", "sleepDiastolicLoad", "sleepSystolic", "sleepSystolicLoad", "source", "specialSituations", "status", "systolicNightDipping", "technicalComments", "totalMeasurements", "updatedAt", "usedAiFallback", "validMeasurements", "validMeasurementsPercentage" FROM "MapaReport";
DROP TABLE "MapaReport";
ALTER TABLE "new_MapaReport" RENAME TO "MapaReport";
CREATE INDEX "MapaReport_patientId_idx" ON "MapaReport"("patientId");
CREATE INDEX "MapaReport_status_idx" ON "MapaReport"("status");
CREATE INDEX "MapaReport_createdAt_idx" ON "MapaReport"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
