-- CreateTable
CREATE TABLE "FareQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rideRequestId" TEXT,
    "airportId" TEXT,
    "destinationZone" TEXT NOT NULL,
    "soloFarePaise" INTEGER NOT NULL,
    "poolFarePaise" INTEGER NOT NULL,
    "minSavingPct" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "surgeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FareQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareTripToken" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareTripToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FareQuote_userId_status_idx" ON "FareQuote"("userId", "status");

-- CreateIndex
CREATE INDEX "FareQuote_rideRequestId_idx" ON "FareQuote"("rideRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareTripToken_token_key" ON "ShareTripToken"("token");

-- CreateIndex
CREATE INDEX "ShareTripToken_token_idx" ON "ShareTripToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DriverDocument_driverId_docType_key" ON "DriverDocument"("driverId", "docType");

-- AddForeignKey
ALTER TABLE "FareQuote" ADD CONSTRAINT "FareQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareQuote" ADD CONSTRAINT "FareQuote_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareTripToken" ADD CONSTRAINT "ShareTripToken_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
