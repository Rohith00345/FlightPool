import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["DRIVER", "ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  try {
    // If authenticated as driver, find their trips
    const driver = await prisma.driver.findFirst({
      where: {
        OR: [
          { phone: auth.session.phone },
          { id: auth.session.userId },
        ],
      },
    });

    const whereClause =
      driver && auth.session.role === "DRIVER"
        ? { driverId: driver.id }
        : {};

    const trips = await prisma.trip.findMany({
      where: whereClause,
      include: {
        driver: true,
        vehicle: true,
        pool: {
          include: {
            members: {
              include: { user: true, rideRequest: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      trips: trips.map((t) => ({
        id: t.id,
        status: t.status,
        driverName: t.driver.name,
        vehicleNumber: t.vehicle.licensePlate,
        totalFare: t.totalFare,
        driverPayout: t.driverPayout,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error("Driver trips fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load driver trips", details: String(error) },
      { status: 500 }
    );
  }
}
