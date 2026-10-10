import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  computeAverageWaitTime,
  computeFillRates,
  computeCapturedRevenue,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  try {
    const [
      totalRequestsCount,
      pooledRequestsCount,
      pools,
      trips,
      incidents,
      flights,
      payments,
      matchedRequests,
    ] = await Promise.all([
      prisma.rideRequest.count(),
      prisma.rideRequest.count({
        where: { status: { in: ["POOLING", "CONFIRMED", "COMPLETED", "SOLO"] } },
      }),
      prisma.pool.findMany({
        include: {
          members: true,
          vehicle: true,
          driver: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.trip.findMany({
        include: { driver: true, vehicle: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.incident.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.flight.findMany({
        orderBy: { arrivalTime: "desc" },
        take: 15,
        include: {
          _count: {
            select: { rideRequests: true },
          },
        },
      }),
      prisma.payment.findMany({
        where: { status: { in: ["AUTHORIZED", "CAPTURED"] } },
      }),
      // Query matched requests for accurate wait time calculation (last 24 hours)
      prisma.rideRequest.findMany({
        where: {
          status: { in: ["POOLING", "CONFIRMED", "COMPLETED", "SOLO"] },
          OR: [
            { readyAt: { not: null } },
            { readyTime: { not: null } },
          ],
        },
        include: {
          poolMembers: {
            include: { pool: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const matchRate =
      totalRequestsCount > 0
        ? Number(((pooledRequestsCount / totalRequestsCount) * 100).toFixed(1))
        : 0;

    // B3: Fill rate with and without solo pools
    const fillRateStats = computeFillRates(
      pools.map((p) => ({
        id: p.id,
        memberCount: p.members.length,
        status: p.status,
      }))
    );

    const allMembers = pools.flatMap((p) => p.members);
    const totalDetour = allMembers.reduce((s, m) => s + m.detourMinutes, 0);
    const avgDetour =
      allMembers.length > 0 ? Number((totalDetour / allMembers.length).toFixed(1)) : 0;

    // B1: Define wait = pool confirmedAt minus rideRequest readyAt for matched requests in last 24h
    // Ignore stale seed data; show '-' when there is no data.
    const waitRecords = matchedRequests.map((r) => {
      const readyDate = r.readyAt || r.readyTime || r.createdAt;
      const pool = r.poolMembers[0]?.pool;
      const confirmedDate =
        pool?.confirmedAt ||
        (pool?.status === "CONFIRMED" || pool?.status === "COMPLETED"
          ? pool?.updatedAt || r.poolMembers[0]?.joinedAt
          : null);

      return {
        readyAt: readyDate,
        confirmedAt: confirmedDate,
      };
    });

    const waitStats = computeAverageWaitTime(waitRecords, new Date());

    // B4: Rename Platform Rev to 'Captured revenue (completed trips)' & compute strictly on completed trips
    const capturedRevStats = computeCapturedRevenue(
      trips.map((t) => ({
        status: t.status,
        platformFee: t.platformFee,
        totalFare: t.totalFare,
      }))
    );

    const totalFaresCollected = payments.reduce((s, p) => s + p.amount, 0);
    const driverPayouts = trips
      .filter((t) => t.status === "COMPLETED")
      .reduce((s, t) => s + t.driverPayout, 0);

    return NextResponse.json({
      metrics: {
        totalRequestsCount,
        pooledRequestsCount,
        matchRate,
        fillRate: fillRateStats.fillRateTotal,
        fillRateWithoutSolo: fillRateStats.fillRateWithoutSolo,
        soloPoolsCount: fillRateStats.soloPoolsCount,
        sharedPoolsCount: fillRateStats.sharedPoolsCount,
        avgDetourMinutes: avgDetour,
        avgWaitMinutes: waitStats.avgWaitMinutes,
        avgWaitDisplay: waitStats.display,
        totalFaresCollected,
        platformRevenue: capturedRevStats.capturedRevenueRupees,
        capturedRevenueCompletedTrips: capturedRevStats.capturedRevenueRupees,
        capturedRevenueLabel: "Captured revenue (completed trips)",
        driverPayouts,
        activeIncidentsCount: incidents.filter((i) => i.status === "ACTIVE").length,
      },
      // B3: Label single-rider confirmed pools "Solo"
      pools: pools.map((p) => {
        const isSolo = p.members.length === 1;
        const isConfirmed = p.status === "CONFIRMED";
        const displayLabel = isSolo && isConfirmed ? "Solo" : p.status;
        const normalizedTerminal = p.terminal === "T1" ? "T1" : "T2";

        return {
          id: p.id,
          terminal: normalizedTerminal,
          destinationCluster: p.destinationCluster,
          status: p.status,
          displayLabel,
          isSolo,
          poolType: isSolo ? "Solo" : "Shared",
          membersCount: p.members.length,
          driverName: p.driver?.name || "Pending",
          vehicle: p.vehicle ? `${p.vehicle.make} ${p.vehicle.model}` : "Pending",
          createdAt: p.createdAt,
          confirmedAt: p.confirmedAt,
        };
      }),
      trips: trips.map((t) => ({
        id: t.id,
        status: t.status,
        driverName: t.driver.name,
        vehicleNumber: t.vehicle.licensePlate,
        totalFare: t.totalFare,
        driverPayout: t.driverPayout,
        platformFee: t.platformFee,
        otpCode: t.otpCode,
        createdAt: t.createdAt,
      })),
      incidents,
      // B5: Normalized "T1/T2" airport terminal format
      flights: flights.map((f) => ({
        id: f.id,
        flightNumber: f.flightNumber,
        airline: f.airline,
        origin: f.origin,
        terminal: f.terminal === "T1" ? "T1" : "T2",
        status: f.status,
        arrivalTime: f.arrivalTime,
        requestsCount: f._count.rideRequests,
      })),
    });
  } catch (error: unknown) {
    console.error("Admin metrics error:", error);
    return NextResponse.json(
      { error: "Failed to load admin metrics", details: String(error) },
      { status: 500 }
    );
  }
}
