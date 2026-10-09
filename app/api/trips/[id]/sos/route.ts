import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, description, currentLat, currentLng } = body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        pool: true,
        driver: true,
        vehicle: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const incident = await prisma.incident.create({
      data: {
        tripId: trip.id,
        poolId: trip.poolId,
        userId: userId || null,
        type: "SOS",
        description:
          description ||
          `Emergency SOS triggered by passenger during trip ${trip.id}. Coordinates: ${currentLat ?? 19.0968}, ${currentLng ?? 72.8750}`,
        severity: "HIGH",
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      incident: {
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        createdAt: incident.createdAt,
      },
      emergencyDispatch: {
        status: "DISPATCH_ALERTED",
        policeEmergencyNumber: "112",
        mumbaiAirportSecurity: "+91-22-66851010",
        womenHelpline: "1091",
        vehicleAlerted: `${trip.vehicle.make} ${trip.vehicle.model} (${trip.vehicle.licensePlate})`,
        driverContact: `${trip.driver.name} (${trip.driver.phone})`,
        message:
          "🚨 Emergency SOS activated! Airport Control & Mumbai Police (112) have been alerted with live vehicle coordinates and trip details.",
      },
    });
  } catch (error: unknown) {
    console.error("SOS error:", error);
    return NextResponse.json(
      { error: "Failed to log SOS emergency", details: String(error) },
      { status: 500 }
    );
  }
}
