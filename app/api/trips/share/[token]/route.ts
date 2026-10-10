import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const shareRecord = await prisma.shareTripToken.findUnique({
      where: { token },
      include: {
        trip: {
          include: {
            driver: {
              select: {
                name: true,
                rating: true,
                currentLat: true,
                currentLng: true,
              },
            },
            vehicle: {
              select: {
                make: true,
                model: true,
                color: true,
                licensePlate: true,
              },
            },
            pool: {
              select: {
                terminal: true,
                destinationCluster: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!shareRecord || shareRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Share link is invalid or has expired." },
        { status: 404 }
      );
    }

    const { trip } = shareRecord;

    // Mask license plate for public safety (e.g., MH02AB1234 -> MH02••1234)
    const plate = trip.vehicle.licensePlate;
    const maskedPlate =
      plate.length >= 8
        ? `${plate.slice(0, 4)}••${plate.slice(-4)}`
        : plate;

    return NextResponse.json({
      active: true,
      tripId: trip.id,
      status: trip.status,
      terminal: trip.pool.terminal,
      destinationZone: trip.pool.destinationCluster,
      driver: {
        name: trip.driver.name,
        rating: trip.driver.rating,
        lat: trip.driver.currentLat,
        lng: trip.driver.currentLng,
      },
      vehicle: {
        make: trip.vehicle.make,
        model: trip.vehicle.model,
        color: trip.vehicle.color,
        maskedPlate,
      },
      expiresAt: shareRecord.expiresAt,
    });
  } catch (error: unknown) {
    console.error("Public share view error:", error);
    return NextResponse.json(
      { error: "Failed to load shared trip", details: String(error) },
      { status: 500 }
    );
  }
}
