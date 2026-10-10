-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN     "autoSoloConsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "driverAtBayAt" TIMESTAMP(3);
