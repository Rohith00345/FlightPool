-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN     "readyAt" TIMESTAMP(3);
