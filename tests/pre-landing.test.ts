import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { signSessionToken } from "../lib/auth";
import { POST, GET, PATCH } from "../app/api/rides/pre-landing/route";
import { NextRequest } from "next/server";

describe("Phase 2: In-Flight Wi-Fi Pre-Landing Booking Queue", () => {
  let testUser: { id: string; name: string; phone: string; role: "RIDER" | "DRIVER" | "ADMIN" | "MARSHAL" | "SUPPORT" };
  let testFlight: { id: string; flightNumber: string; terminal: string };
  let validToken: string;

  beforeAll(async () => {
    // Setup test rider
    const userRecord = await prisma.user.upsert({
      where: { phone: "+919999888777" },
      update: {},
      create: {
        name: "Aviation Passenger",
        phone: "+919999888777",
        role: "RIDER",
        gender: "MALE",
      },
    });
    testUser = {
      id: userRecord.id,
      name: userRecord.name,
      phone: userRecord.phone,
      role: userRecord.role as "RIDER",
    };

    // Setup test flight
    testFlight = await prisma.flight.findFirstOrThrow({
      where: { terminal: "T2" },
    });

    validToken = signSessionToken({
      userId: testUser.id,
      role: testUser.role,
      name: testUser.name,
      phone: testUser.phone,
    });
  });

  afterAll(async () => {
    // Clean up created requests for test user
    await prisma.rideRequest.deleteMany({
      where: { userId: testUser.id },
    });
  });

  it("1. Rejects missing required parameters with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/rides/pre-landing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        userId: testUser.id,
        // missing flightId and destinationZone
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("required");
  });

  it("2. Blocks cross-user IDOR attempt with 403", async () => {
    const attackerToken = signSessionToken({
      userId: "different_user_id_999",
      role: "RIDER",
      name: "Attacker",
      phone: "+919999999999",
    });

    const req = new NextRequest("http://localhost:3000/api/rides/pre-landing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${attackerToken}`,
      },
      body: JSON.stringify({
        userId: testUser.id,
        flightId: testFlight.id,
        destinationZone: "Thane",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("3. Creates in-flight pre-queue request with QUEUED_IN_FLIGHT status and null readyAt", async () => {
    const req = new NextRequest("http://localhost:3000/api/rides/pre-landing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        userId: testUser.id,
        flightId: testFlight.id,
        destinationZone: "Thane",
        destinationAddress: "Majiwada Junction, Thane West",
        luggageCount: 2,
        womenOnly: false,
        seatNumber: "16C",
        pnr: "PNR999",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.rideRequest.status).toBe("QUEUED_IN_FLIGHT");
    expect(json.rideRequest.readyAt).toBeNull();
    expect(json.rideRequest.estimatedPoolFare).toBeGreaterThan(0);
    expect(json.rideRequest.estimatedSavings).toBeGreaterThan(0);

    // Verify persisted directly in database
    const dbRecord = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: json.rideRequest.id },
    });
    expect(dbRecord.status).toBe("QUEUED_IN_FLIGHT");
    expect(dbRecord.readyAt).toBeNull();
  });

  it("4. GET /api/rides/pre-landing returns active in-flight queue telemetry", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/rides/pre-landing?userId=${testUser.id}`,
      {
        headers: { Authorization: `Bearer ${validToken}` },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.hasQueuedRequest).toBe(true);
    expect(json.rideRequest.status).toBe("QUEUED_IN_FLIGHT");
    expect(json.canConfirmTouchdown).toBe(true);
  });

  it("5. PATCH /api/rides/pre-landing confirms touchdown and transitions to POOLING", async () => {
    const currentReq = await prisma.rideRequest.findFirstOrThrow({
      where: { userId: testUser.id, status: "QUEUED_IN_FLIGHT" },
    });

    const patchReq = new NextRequest("http://localhost:3000/api/rides/pre-landing", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        requestId: currentReq.id,
        action: "TOUCHDOWN_CONFIRMED",
      }),
    });

    const res = await PATCH(patchReq);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.status).toBe("POOLING");

    // Verify in database: readyAt must now be stamped
    const updatedRecord = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: currentReq.id },
    });
    expect(updatedRecord.status).toBe("POOLING");
    expect(updatedRecord.readyAt).not.toBeNull();
  });
});
