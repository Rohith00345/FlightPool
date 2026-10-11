import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { calculateGstBreakdown, generateTripReceipt, FLIGHTPOOL_COMPANY_INFO } from "../lib/invoice";
import { prisma } from "../lib/prisma";
import { signSessionToken } from "../lib/auth";
import { NextRequest } from "next/server";

describe("GST Invoicing, Trip Receipts & Rider History", () => {
  let riderA: { id: string; name: string; phone: string; role: "RIDER" };
  let riderB: { id: string; name: string; phone: string; role: "RIDER" };
  let testTrip: { id: string };
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test riders
    const userA = await prisma.user.upsert({
      where: { phone: "+919988771122" },
      update: {},
      create: { name: "Rider Invoice A", phone: "+919988771122", role: "RIDER" },
    });
    riderA = { id: userA.id, name: userA.name, phone: userA.phone, role: "RIDER" };

    const userB = await prisma.user.upsert({
      where: { phone: "+919988771133" },
      update: {},
      create: { name: "Rider Invoice B", phone: "+919988771133", role: "RIDER" },
    });
    riderB = { id: userB.id, name: userB.name, phone: userB.phone, role: "RIDER" };

    tokenA = signSessionToken({ userId: riderA.id, role: "RIDER", name: riderA.name, phone: riderA.phone });
    tokenB = signSessionToken({ userId: riderB.id, role: "RIDER", name: riderB.name, phone: riderB.phone });
    adminToken = signSessionToken({ userId: "admin_inv_test", role: "ADMIN", phone: "+919999999999" });

    // Find or link a trip for rider A
    const flight = await prisma.flight.findFirstOrThrow();
    const rideRequest = await prisma.rideRequest.create({
      data: {
        userId: riderA.id,
        flightId: flight.id,
        destinationZone: "Thane",
        destinationAddress: "Ghodbunder Road, Thane West",
        destinationLat: 19.26,
        destinationLng: 72.96,
        status: "COMPLETED",
      },
    });

    const pool = await prisma.pool.create({
      data: {
        terminal: "T2",
        corridor: "Thane",
        status: "COMPLETED",
      },
    });

    await prisma.poolMember.create({
      data: {
        poolId: pool.id,
        userId: riderA.id,
        rideRequestId: rideRequest.id,
        soloFare: 600,
        poolFare: 420,
        status: "CONFIRMED",
        pickupOrder: 1,
        dropoffOrder: 1,
      },
    });

    const driver = await prisma.driver.findFirstOrThrow({ include: { vehicle: true } });
    const vehicle = driver.vehicle || (await prisma.vehicle.findFirstOrThrow());
    const trip = await prisma.trip.create({
      data: {
        pool: { connect: { id: pool.id } },
        driver: { connect: { id: driver.id } },
        vehicle: { connect: { id: vehicle.id } },
        status: "COMPLETED",
        totalFare: 420,
      },
    });
    testTrip = { id: trip.id };
  });

  afterAll(async () => {
    if (testTrip?.id) {
      await prisma.trip.deleteMany({ where: { id: testTrip.id } });
    }
  });

  describe("Unit: GST Tax Calculations (SAC 996412)", () => {
    it("computes 5% GST inclusive breakdown accurately with integer paise", () => {
      // For a ₹420 (42000 paise) fare:
      // Taxable = 42000
      // Base = Math.round(42000 / 1.05) = 40000 paise (₹400)
      // Total Tax = 2000 paise (₹20)
      // CGST = 1000 paise (₹10), SGST = 1000 paise (₹10)
      const breakdown = calculateGstBreakdown(42000, 0);

      expect(breakdown.sacCode).toBe("996412");
      expect(breakdown.baseFarePaise).toBe(40000);
      expect(breakdown.cgstPaise).toBe(1000);
      expect(breakdown.sgstPaise).toBe(1000);
      expect(breakdown.totalTaxPaise).toBe(2000);
      expect(breakdown.baseFarePaise + breakdown.totalTaxPaise).toBe(42000);
      expect(breakdown.baseFareRupees).toBe(400);
      expect(breakdown.cgstRupees).toBe(10);
      expect(breakdown.sgstRupees).toBe(10);
      expect(breakdown.totalPaidRupees).toBe(420);
    });

    it("generates structured GST receipt with company GSTIN and invoice number", () => {
      const receipt = generateTripReceipt({
        tripId: "trip_mock_998877",
        passengerName: "Aarav Sharma",
        pickupLocation: "CSMIA Terminal 2",
        dropoffLocation: "Hiranandani Estate, Thane",
        corridor: "Thane",
        totalPaidPaise: 42000,
        coRidersCount: 2,
      });

      expect(receipt.invoiceNumber).toMatch(/^FP\/INV\/\d{6}\/[A-Z0-9]+$/);
      expect(receipt.gstin).toBe(FLIGHTPOOL_COMPANY_INFO.gstin);
      expect(receipt.companyName).toBe(FLIGHTPOOL_COMPANY_INFO.companyName);
      expect(receipt.fareBreakdown.sacCode).toBe("996412");
      expect(receipt.co2SavedKg).toBe(7.8);
    });
  });

  describe("API: /api/trips/[id]/receipt IDOR & RBAC", () => {
    it("rejects unauthenticated request with 401", async () => {
      const { GET } = await import("../app/api/trips/[id]/receipt/route");
      const req = new NextRequest(`http://localhost:3000/api/trips/${testTrip.id}/receipt`);
      const res = await GET(req, { params: Promise.resolve({ id: testTrip.id }) });
      expect(res.status).toBe(401);
    });

    it("blocks cross-user IDOR access (Rider B cannot view Rider A's receipt) with 403", async () => {
      const { GET } = await import("../app/api/trips/[id]/receipt/route");
      const req = new NextRequest(`http://localhost:3000/api/trips/${testTrip.id}/receipt`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const res = await GET(req, { params: Promise.resolve({ id: testTrip.id }) });
      expect(res.status).toBe(403);
    });

    it("allows confirmed trip passenger (Rider A) to download receipt with 200", async () => {
      const { GET } = await import("../app/api/trips/[id]/receipt/route");
      const req = new NextRequest(`http://localhost:3000/api/trips/${testTrip.id}/receipt`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const res = await GET(req, { params: Promise.resolve({ id: testTrip.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.receipt.tripId).toBe(testTrip.id);
      expect(json.receipt.gstin).toBeDefined();
      expect(json.receipt.fareBreakdown.totalPaidRupees).toBe(420);
    });

    it("allows ADMIN to access receipt with 200", async () => {
      const { GET } = await import("../app/api/trips/[id]/receipt/route");
      const req = new NextRequest(`http://localhost:3000/api/trips/${testTrip.id}/receipt`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await GET(req, { params: Promise.resolve({ id: testTrip.id }) });
      expect(res.status).toBe(200);
    });
  });

  describe("API: /api/user/trips", () => {
    it("returns rider's completed trip history with receipt availability", async () => {
      const { GET } = await import("../app/api/user/trips/route");
      const req = new NextRequest("http://localhost:3000/api/user/trips", {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.trips.length).toBeGreaterThanOrEqual(1);

      const tripRecord = json.trips.find((t: { tripId: string }) => t.tripId === testTrip.id);
      expect(tripRecord).toBeDefined();
      expect(tripRecord.destinationZone).toBe("Thane");
      expect(tripRecord.receiptAvailable).toBe(true);
      expect(tripRecord.receiptUrl).toBe(`/api/trips/${testTrip.id}/receipt`);
    });
  });
});
