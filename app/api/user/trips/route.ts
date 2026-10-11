import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/trips
 * Returns the authenticated rider's trip history with receipts and corridor details.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const poolMemberships = await prisma.poolMember.findMany({
      where: { userId: session.userId },
      include: {
        pool: {
          include: {
            trip: {
              include: {
                driver: {
                  include: {
                    vehicle: true,
                  },
                },
              },
            },
            members: true,
          },
        },
        rideRequest: {
          include: {
            flight: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
      take: 50,
    });

    const trips = poolMemberships.map((pm) => {
      const trip = pm.pool.trip;
      const flight = pm.rideRequest.flight;
      const status = trip?.status || pm.pool.status;
      const isCompleted = status === "COMPLETED";

      return {
        memberId: pm.id,
        tripId: trip?.id || null,
        poolId: pm.poolId,
        date: pm.joinedAt.toISOString(),
        status,
        origin: `CSMIA ${flight?.terminal || "T2"}`,
        destinationZone: pm.rideRequest.destinationZone,
        destinationAddress: pm.rideRequest.destinationAddress,
        fareRupees: pm.poolFare,
        coRidersCount: pm.pool.members.length,
        driverName: trip?.driver?.name || "Pending Assignment",
        vehiclePlate: trip?.driver?.vehicle?.licensePlate || null,
        receiptAvailable: isCompleted && !!trip?.id,
        receiptUrl: isCompleted && trip?.id ? `/api/trips/${trip.id}/receipt` : null,
      };
    });

    return NextResponse.json({
      success: true,
      userId: session.userId,
      count: trips.length,
      trips,
    });
  } catch (error) {
    console.error("Trip history error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching trip history" },
      { status: 500 }
    );
  }
}
