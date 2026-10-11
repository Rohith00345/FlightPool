-- CreateTable
CREATE TABLE "DriverQueueEntry" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "terminalCode" TEXT NOT NULL,
    "assignedBay" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "autoShareAtNight" BOOLEAN NOT NULL DEFAULT true,
    "consentStatus" TEXT NOT NULL DEFAULT 'PENDING_CONSENT',
    "consentRequestedAt" TIMESTAMP(3),
    "consentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverQueueEntry_driverId_key" ON "DriverQueueEntry"("driverId");

-- CreateIndex
CREATE INDEX "DriverQueueEntry_terminalCode_status_joinedAt_idx" ON "DriverQueueEntry"("terminalCode", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "EmergencyContact_phone_idx" ON "EmergencyContact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_userId_phone_key" ON "EmergencyContact"("userId", "phone");

-- AddForeignKey
ALTER TABLE "DriverQueueEntry" ADD CONSTRAINT "DriverQueueEntry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
