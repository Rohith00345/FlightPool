import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { NextRequest } from "next/server";
import { POST as requestRide } from "../app/api/rides/request/route";
import { POST as matchPools } from "../app/api/pools/match/route";
import { GET as getRideStatus } from "../app/api/rides/status/route";
import { signSessionToken } from "../lib/auth";

describe("Regression: Corridor Step to Pool Step Transition", () => {
  let testUserIdResolved = "usr_corridor_test_01";
  const testFlightId = "fl_corridor_test_01";
  let riderToken: string;

  beforeAll(async () => {
    // Clean up any existing test records
    await prisma.poolMember.deleteMany({ where: { user: { phone: "+919811445566" } } }).catch(() => {});
    await prisma.rideRequest.deleteMany({ where: { user: { phone: "+919811445566" } } }).catch(() => {});
    await prisma.flight.deleteMany({ where: { id: testFlightId } }).catch(() => {});

    // Create test flight
    await prisma.flight.create({
      data: {
        id: testFlightId,
        flightNumber: "6E-CORRIDOR-99",
        airline: "IndiGo",
        origin: "DEL",
        destination: "BOM",
        terminal: "T2",
        arrivalTime: new Date(),
        status: "LANDED",
      },
    });

    // Upsert test user
    const user = await prisma.user.upsert({
      where: { phone: "+919811445566" },
      update: {
        name: "Corridor Test Passenger",
        role: "RIDER",
        gender: "MALE",
      },
      create: {
        id: "usr_corridor_test_01",
        name: "Corridor Test Passenger",
        phone: "+919811445566",
        role: "RIDER",
        gender: "MALE",
      },
    });

    testUserIdResolved = user.id;

    riderToken = signSessionToken({
      userId: user.id,
      role: "RIDER",
      phone: "+919811445566",
      name: "Corridor Test Passenger",
    });
  });

  afterAll(async () => {
    await prisma.poolMember.deleteMany({ where: { userId: testUserIdResolved } }).catch(() => {});
    await prisma.rideRequest.deleteMany({ where: { userId: testUserIdResolved } }).catch(() => {});
    await prisma.flight.deleteMany({ where: { id: testFlightId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserIdResolved } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("successfully moves from corridor selection to pool forming upon clicking I've Landed & Ready", async () => {
    // 1. Rider clicks 'I'VE LANDED & READY' on Corridor step
    const readyReq = new NextRequest("http://localhost:3000/api/rides/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        userId: testUserIdResolved,
        flightId: testFlightId,
        destinationZone: "Thane",
        destinationAddress: "Hiranandani Estate, Thane West",
        destinationLat: 19.25,
        destinationLng: 72.98,
        luggageCount: 1,
        womenOnly: false,
        isReady: true, // Wheels down / ready signal
      }),
    });

    const readyRes = await requestRide(readyReq);
    expect(readyRes.status).toBe(200);

    const readyData = await readyRes.json();
    expect(readyData.success).toBe(true);
    expect(readyData.rideRequest).toBeDefined();
    expect(readyData.rideRequest.status).toBe("POOLING");
    expect(readyData.rideRequest.readyTime).not.toBeNull();

    // Verify readyAt column exists and is populated in PostgreSQL
    const dbRequest = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: readyData.rideRequest.id },
    });
    expect(dbRequest.readyAt).not.toBeNull();
    expect(dbRequest.readyTime).not.toBeNull();
    expect(dbRequest.status).toBe("POOLING");

    // 2. Client triggers pool matching engine
    const matchReq = new NextRequest("http://localhost:3000/api/pools/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({ flightId: testFlightId }),
    });

    const matchRes = await matchPools(matchReq);
    expect([200, 201]).toContain(matchRes.status);

    // 3. Client polls /api/rides/status: verifies transition to Pool Step
    const statusReq = new NextRequest(`http://localhost:3000/api/rides/status?userId=${testUserIdResolved}`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });

    const statusRes = await getRideStatus(statusReq);
    expect(statusRes.status).toBe(200);

    const statusData = await statusRes.json();
    expect(statusData.activeRequest).toBeDefined();
    expect(statusData.activeRequest.id).toBe(readyData.rideRequest.id);
    expect(statusData.activeRequest.status).toBe("POOLING");
  });

  it("displays clear error with retry on failing ride request instead of silent failure", async () => {
    // Missing required flightId
    const invalidReq = new NextRequest("http://localhost:3000/api/rides/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        userId: testUserIdResolved,
        destinationZone: "Thane",
      }),
    });

    const invalidRes = await requestRide(invalidReq);
    expect(invalidRes.status).toBe(400);

    const invalidData = await invalidRes.json();
    expect(invalidData.error).toContain("required");
  });
});
