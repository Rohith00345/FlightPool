import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot access another user's ride status" },
        { status: 403 }
      );
    }

    // Find the latest active ride request for this user
    const rideRequest = await prisma.rideRequest.findFirst({
      where: {
        userId,
        status: { in: ["SEARCHING", "POOLING", "CONFIRMED", "SOLO", "COMPLETED"] },
      },
      include: {
        flight: true,
        poolMembers: {
          include: {
            pool: {
              include: {
                vehicle: true,
                driver: true,
                trip: true,
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        gender: true,
                      },
                    },
                    rideRequest: {
                      select: {
                        destinationZone: true,
                        destinationAddress: true,
                        luggageCount: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!rideRequest) {
      return NextResponse.json({ activeRequest: null });
    }

    const currentMember = rideRequest.poolMembers.find(
      (m) => m.pool.status !== "CANCELLED"
    );

    // If rider is part of a pool
    if (currentMember) {
      const pool = currentMember.pool;
      const isConfirmed = pool.status === "CONFIRMED" || pool.status === "COMPLETED";
      const now = new Date();
      const waitCapExpiry = pool.waitCapExpiry ? new Date(pool.waitCapExpiry) : null;
      const isWaitCapExpired = waitCapExpiry ? now.getTime() >= waitCapExpiry.getTime() : false;

      // Anonymize other riders' addresses until confirmed (Safety requirement)
      const sanitizedMembers = pool.members.map((m) => {
        const isSelf = m.userId === userId;
        return {
          id: m.id,
          userId: m.userId,
          name: isSelf ? m.user.name : m.user.name.split(" ")[0] + " (Co-rider)",
          gender: m.user.gender,
          destinationZone: m.rideRequest.destinationZone,
          destinationAddress:
            isSelf || isConfirmed
              ? m.rideRequest.destinationAddress
              : `${m.rideRequest.destinationZone} Area (Exact hidden until confirmation)`,
          luggageCount: m.rideRequest.luggageCount,
          dropoffOrder: m.dropoffOrder,
          poolFare: m.poolFare,
          soloFare: m.soloFare,
          savingsPct: m.savingsPct,
          isSelf,
        };
      });

      return NextResponse.json({
        activeRequest: {
          id: rideRequest.id,
          status: rideRequest.status,
          readyTime: rideRequest.readyTime,
          destinationZone: rideRequest.destinationZone,
          destinationAddress: rideRequest.destinationAddress,
          destinationLat: rideRequest.destinationLat,
          destinationLng: rideRequest.destinationLng,
          luggageCount: rideRequest.luggageCount,
          womenOnly: rideRequest.womenOnly,
          flight: {
            id: rideRequest.flight.id,
            flightNumber: rideRequest.flight.flightNumber,
            airline: rideRequest.flight.airline,
            origin: rideRequest.flight.origin,
            terminal: rideRequest.flight.terminal,
            status: rideRequest.flight.status,
          },
        },
        pool: {
          id: pool.id,
          status: pool.status,
          destinationCluster: pool.destinationCluster,
          terminal: pool.terminal,
          waitCapExpiry: pool.waitCapExpiry,
          isWaitCapExpired,
          membersCount: pool.members.length,
          maxCapacity: 3,
          members: sanitizedMembers,
          myShare: {
            soloFare: currentMember.soloFare,
            poolFare: currentMember.poolFare,
            savingsPct: currentMember.savingsPct,
            detourMinutes: currentMember.detourMinutes,
            dropoffOrder: currentMember.dropoffOrder,
          },
          vehicle: pool.vehicle
            ? {
                make: pool.vehicle.make,
                model: pool.vehicle.model,
                licensePlate: pool.vehicle.licensePlate,
                color: pool.vehicle.color,
                type: pool.vehicle.type,
              }
            : null,
          driver: pool.driver
            ? {
                id: pool.driver.id,
                name: pool.driver.name,
                phone: pool.driver.phone,
                rating: pool.driver.rating,
              }
            : null,
          trip: pool.trip
            ? {
                id: pool.trip.id,
                status: pool.trip.status,
                otpCode: pool.trip.otpCode,
                totalFare: pool.trip.totalFare,
                driverPayout: pool.trip.driverPayout,
                platformFee: pool.trip.platformFee,
                totalDistanceKm: pool.trip.totalDistanceKm,
                totalDurationMin: pool.trip.totalDurationMin,
              }
            : null,
        },
      });
    }

    // If not in a pool yet, count other riders on same flight / zone
    const nearbyCount = await prisma.rideRequest.count({
      where: {
        flightId: rideRequest.flightId,
        destinationZone: rideRequest.destinationZone,
        status: { in: ["SEARCHING", "POOLING"] },
        NOT: { id: rideRequest.id },
      },
    });

    const readyTime = rideRequest.readyTime ? new Date(rideRequest.readyTime) : null;
    const isWaitExpired = readyTime ? (Date.now() - readyTime.getTime()) > 20 * 60 * 1000 : false;

    return NextResponse.json({
      activeRequest: {
        id: rideRequest.id,
        status: rideRequest.status,
        readyTime: rideRequest.readyTime,
        destinationZone: rideRequest.destinationZone,
        destinationAddress: rideRequest.destinationAddress,
        destinationLat: rideRequest.destinationLat,
        destinationLng: rideRequest.destinationLng,
        luggageCount: rideRequest.luggageCount,
        womenOnly: rideRequest.womenOnly,
        isWaitCapExpired: isWaitExpired,
        flight: {
          id: rideRequest.flight.id,
          flightNumber: rideRequest.flight.flightNumber,
          airline: rideRequest.flight.airline,
          origin: rideRequest.flight.origin,
          terminal: rideRequest.flight.terminal,
          status: rideRequest.flight.status,
        },
      },
      pool: null,
      coRidersFound: nearbyCount,
    });
  } catch (error: unknown) {
    console.error("Ride status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ride status", details: String(error) },
      { status: 500 }
    );
  }
}
