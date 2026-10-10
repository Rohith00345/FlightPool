import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const roleCheck = requireRole(req, ["MARSHAL", "ADMIN"]);
    if (roleCheck.response) return roleCheck.response;

    const url = new URL(req.url);
    const terminalCode = url.searchParams.get("terminal") || "T2";

    const terminals = await prisma.terminal.findMany({
      include: {
        pickupBays: true,
      },
      orderBy: { code: "asc" },
    });

    const activeTerminal = terminals.find((t) => t.code === terminalCode) || terminals[0];

    // Find active trips arriving at or boarding at this terminal
    const activeTrips = await prisma.trip.findMany({
      where: {
        pool: {
          terminal: activeTerminal?.code || "T2",
          status: { in: ["CONFIRMED", "DISPATCHED", "FORMING"] },
        },
      },
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
      terminals: terminals.map((t) => ({
        code: t.code,
        name: t.name,
        bays: t.pickupBays.map((b) => ({ id: b.id, label: b.label, active: b.active })),
      })),
      selectedTerminal: activeTerminal?.code,
      activeTrips: activeTrips.map((trip) => ({
        id: trip.id,
        status: trip.status,
        otpCode: trip.otpCode,
        cluster: trip.pool.destinationCluster,
        driver: {
          name: trip.driver.name,
          phone: trip.driver.phone,
          rating: trip.driver.rating,
        },
        vehicle: {
          make: trip.vehicle.make,
          model: trip.vehicle.model,
          licensePlate: trip.vehicle.licensePlate,
          color: trip.vehicle.color,
        },
        riders: trip.pool.members.map((m) => ({
          id: m.id,
          name: m.user.name,
          phone: m.user.phone,
          destination: m.rideRequest.destinationAddress,
          status: m.status,
          bags: m.rideRequest.luggageCount,
        })),
      })),
    });
  } catch (error: unknown) {
    console.error("Marshal station error:", error);
    return NextResponse.json(
      { error: "Failed to load marshal station data", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const roleCheck = requireRole(req, ["MARSHAL", "ADMIN"]);
    if (roleCheck.response) return roleCheck.response;

    const body = await req.json();
    const { action, tripId, memberId } = body;

    if (action === "VERIFY_BOARDING" && memberId) {
      const updated = await prisma.poolMember.update({
        where: { id: memberId },
        data: { status: "PICKED_UP" },
      });
      return NextResponse.json({ success: true, member: updated });
    }

    if (action === "DISPATCH_TRIP" && tripId) {
      const updated = await prisma.trip.update({
        where: { id: tripId },
        data: { status: "IN_TRANSIT", startTime: new Date() },
      });
      return NextResponse.json({ success: true, trip: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Marshal action error:", error);
    return NextResponse.json(
      { error: "Failed to execute marshal action", details: String(error) },
      { status: 500 }
    );
  }
}
