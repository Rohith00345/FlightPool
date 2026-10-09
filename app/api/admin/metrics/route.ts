import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      totalRequestsCount,
      pooledRequestsCount,
      pools,
      trips,
      incidents,
      flights,
      payments,
      readyRequests,
    ] = await Promise.all([
      prisma.rideRequest.count(),
      prisma.rideRequest.count({
        where: { status: { in: ["POOLING", "CONFIRMED", "COMPLETED"] } },
      }),
      prisma.pool.findMany({
        include: {
          members: true,
          vehicle: true,
          driver: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.trip.findMany({
        include: { driver: true, vehicle: true },
        orderBy: { createdAt: "desc" },
        take: 10,
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
      prisma.rideRequest.findMany({
        where: { readyTime: { not: null } },
        include: { poolMembers: true },
        take: 50,
      }),
    ]);

    const matchRate =
      totalRequestsCount > 0
        ? Number(((pooledRequestsCount / totalRequestsCount) * 100).toFixed(1))
        : 0;

    const totalMembersInPools = pools.reduce((s, p) => s + p.members.length, 0);
    const fillRate =
      pools.length > 0 ? Number((totalMembersInPools / pools.length).toFixed(2)) : 0;

    const allMembers = pools.flatMap((p) => p.members);
    const totalDetour = allMembers.reduce((s, m) => s + m.detourMinutes, 0);
    const avgDetour =
      allMembers.length > 0 ? Number((totalDetour / allMembers.length).toFixed(1)) : 0;

    const waitTimes = readyRequests
      .filter((r) => r.readyTime && r.poolMembers.length > 0)
      .map((r) => Math.abs((r.poolMembers[0].joinedAt.getTime() - r.readyTime!.getTime()) / 60000));
    const avgWaitMinutes =
      waitTimes.length > 0
        ? Number((waitTimes.reduce((s, w) => s + w, 0) / waitTimes.length).toFixed(1))
        : 12.0;

    const totalFaresCollected = payments.reduce((s, p) => s + p.amount, 0);
    const platformRevenue = Math.round(totalFaresCollected * 0.15);
    const driverPayouts = totalFaresCollected - platformRevenue;

    return NextResponse.json({
      metrics: {
        totalRequestsCount,
        pooledRequestsCount,
        matchRate,
        fillRate,
        avgDetourMinutes: avgDetour,
        avgWaitMinutes,
        totalFaresCollected,
        platformRevenue,
        driverPayouts,
        activeIncidentsCount: incidents.filter((i) => i.status === "ACTIVE").length,
      },
      pools: pools.map((p) => ({
        id: p.id,
        terminal: p.terminal,
        destinationCluster: p.destinationCluster,
        status: p.status,
        membersCount: p.members.length,
        driverName: p.driver?.name || "Pending",
        vehicle: p.vehicle ? `${p.vehicle.make} ${p.vehicle.model}` : "Pending",
        createdAt: p.createdAt,
      })),
      trips: trips.map((t) => ({
        id: t.id,
        status: t.status,
        driverName: t.driver.name,
        vehicleNumber: t.vehicle.licensePlate,
        totalFare: t.totalFare,
        driverPayout: t.driverPayout,
        otpCode: t.otpCode,
        createdAt: t.createdAt,
      })),
      incidents,
      flights: flights.map((f) => ({
        id: f.id,
        flightNumber: f.flightNumber,
        airline: f.airline,
        origin: f.origin,
        terminal: f.terminal,
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
