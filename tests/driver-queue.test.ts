import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import {
  calculateHaversineDistanceKm,
  verifyAirportGeofence,
  joinDriverQueue,
  getDriverQueueStatus,
  leaveDriverQueue,
  resetDriverQueues,
  AIRPORT_GEOFENCES,
} from "../lib/driver-queue";
import { prisma } from "../lib/prisma";
import { signSessionToken } from "../lib/auth";
import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../app/api/driver/queue/route";

describe("Driver Virtual Queue & Airport Geofence Staging", () => {
  beforeEach(async () => {
    await resetDriverQueues("T2");
  });

  describe("Unit: Geofencing & Distance Calculations", () => {
    it("calculates accurate distances using Haversine formula", () => {
      // CSMIA T2 (19.0968, 72.8745) to CSMIA T1 (19.0886, 72.8679) is approx 1.14 km
      const distance = calculateHaversineDistanceKm(
        AIRPORT_GEOFENCES.T2.lat,
        AIRPORT_GEOFENCES.T2.lng,
        AIRPORT_GEOFENCES.T1.lat,
        AIRPORT_GEOFENCES.T1.lng
      );
      expect(distance).toBeGreaterThan(0.8);
      expect(distance).toBeLessThan(1.5);
    });

    it("accepts locations inside the 2.5km airport staging geofence", () => {
      // Point 500m north of T2 in Sahar
      const checkInside = verifyAirportGeofence(19.100, 72.875, "T2");
      expect(checkInside.inGeofence).toBe(true);
      expect(checkInside.distanceKm).toBeLessThan(1.0);
      expect(checkInside.nearestTerminal).toBe("T2");
    });

    it("rejects locations outside the 2.5km staging boundary", () => {
      // Dadar West (19.0178, 72.8478) is ~9km away
      const checkDadar = verifyAirportGeofence(19.0178, 72.8478, "T2");
      expect(checkDadar.inGeofence).toBe(false);
      expect(checkDadar.distanceKm).toBeGreaterThan(8.0);

      // Thane West (19.2183, 72.9781) is ~17km away
      const checkThane = verifyAirportGeofence(19.2183, 72.9781, "T2");
      expect(checkThane.inGeofence).toBe(false);
      expect(checkThane.distanceKm).toBeGreaterThan(15.0);
    });
  });

  describe("Unit: FIFO Queue Mechanics & Staging Bays", () => {
    it("enforces FIFO queue ordering and computes accurate wait times", async () => {
      const driver1 = await joinDriverQueue({
        driverId: "drv_1",
        driverName: "Ramesh Sharma",
        phone: "+919876543210",
        vehiclePlate: "MH-02-CP-1001",
        terminalCode: "T2",
        lat: 19.097,
        lng: 72.875,
      });

      expect(driver1.success).toBe(true);
      expect(driver1.position).toBe(1);
      expect(driver1.totalInQueue).toBe(1);
      expect(driver1.assignedBay).toBe("P4 Bay A");

      const driver2 = await joinDriverQueue({
        driverId: "drv_2",
        driverName: "Suresh Patil",
        phone: "+919876543211",
        vehiclePlate: "MH-02-CP-1002",
        terminalCode: "T2",
        lat: 19.096,
        lng: 72.874,
      });

      expect(driver2.success).toBe(true);
      expect(driver2.position).toBe(2);
      expect(driver2.totalInQueue).toBe(2);
      expect(driver2.estimatedWaitMin).toBe(8);
      expect(driver2.assignedBay).toBe("P4 Bay B");

      // Check status of driver 1
      const status1 = await getDriverQueueStatus("drv_1");
      expect(status1.inQueue).toBe(true);
      expect(status1.position).toBe(1);

      // Driver 1 leaves queue -> Driver 2 advances to position 1
      await leaveDriverQueue("drv_1");
      const status2After = await getDriverQueueStatus("drv_2");
      expect(status2After.inQueue).toBe(true);
      expect(status2After.position).toBe(1);
      expect(status2After.totalInQueue).toBe(1);
    });

    it("rejects drivers outside the geofence from entering the queue", async () => {
      const outsideResult = await joinDriverQueue({
        driverId: "drv_outside",
        driverName: "Distant Driver",
        phone: "+919876543299",
        vehiclePlate: "MH-04-AB-9999",
        terminalCode: "T2",
        lat: 19.26, // Thane
        lng: 72.96,
      });

      expect(outsideResult.success).toBe(false);
      expect(outsideResult.position).toBe(0);
      expect(outsideResult.error).toContain("Outside airport staging area");
    });
  });

  describe("API: /api/driver/queue RBAC & Integration", () => {
    const testDriver = {
      id: "drv_queue_test_01",
      name: "Ramesh Sharma",
      phone: "+919876549999",
      createdAt: new Date(),
      updatedAt: new Date(),
      isAvailable: true,
      currentLat: 19.0968,
      currentLng: 72.8745,
      rating: 4.9,
      vehicle: {
        id: "veh_queue_test_01",
        driverId: "drv_queue_test_01",
        licensePlate: "MH-02-CP-8899",
        model: "Toyota Innova",
        capacity: 4,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    let driverToken: string;
    let riderToken: string;

    beforeAll(async () => {
      await prisma.driver.upsert({
        where: { id: testDriver.id },
        update: { name: testDriver.name, phone: testDriver.phone, isAvailable: true },
        create: { id: testDriver.id, name: testDriver.name, phone: testDriver.phone, isAvailable: true, rating: 4.9 },
      }).catch(() => {});

      vi.spyOn(prisma.driver, "findFirst").mockResolvedValue(
        testDriver as unknown as Awaited<ReturnType<typeof prisma.driver.findFirst>>
      );

      driverToken = signSessionToken({
        userId: testDriver.id,
        role: "DRIVER",
        name: testDriver.name,
        phone: testDriver.phone,
      });

      riderToken = signSessionToken({
        userId: "rider_test_queue",
        role: "RIDER",
        phone: "+919988776655",
      });
    });

    afterAll(async () => {
      await prisma.driverQueueEntry.deleteMany({ where: { driverId: testDriver.id } }).catch(() => {});
      await prisma.driver.deleteMany({ where: { id: testDriver.id } }).catch(() => {});
    });

    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/driver/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 19.0968, lng: 72.8745 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects RIDER role with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/driver/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${riderToken}`,
        },
        body: JSON.stringify({ lat: 19.0968, lng: 72.8745 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("rejects check-in with 422 if coordinates are outside airport staging", async () => {
      const req = new NextRequest("http://localhost:3000/api/driver/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ lat: 18.5204, lng: 73.8567 }), // Pune
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toContain("Outside airport staging area");
    });

    it("successfully checks driver into virtual queue when inside geofence", async () => {
      const req = new NextRequest("http://localhost:3000/api/driver/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          lat: 19.0968,
          lng: 72.8745,
          preferredTerminal: "T2",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.position).toBe(1);
      expect(json.terminalCode).toBe("T2");
      expect(json.assignedBay).toBe("P4 Bay A");
    });

    it("queries queue status for authenticated driver with 200", async () => {
      // First ensure driver is queued
      await joinDriverQueue({
        driverId: testDriver.id,
        driverName: testDriver.name,
        phone: testDriver.phone,
        vehiclePlate: "MH-02-CP-8899",
        terminalCode: "T2",
        lat: 19.0968,
        lng: 72.8745,
      });

      const req = new NextRequest("http://localhost:3000/api/driver/queue", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${driverToken}`,
        },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.inQueue).toBe(true);
      expect(json.position).toBe(1);
    });

    it("allows driver to exit virtual queue cleanly", async () => {
      const req = new NextRequest("http://localhost:3000/api/driver/queue", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${driverToken}`,
        },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const check = await getDriverQueueStatus(testDriver.id);
      expect(check.inQueue).toBe(false);
    });
  });
});
