-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "thresholdsJson" TEXT NOT NULL,
    "guidelineFooter" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
