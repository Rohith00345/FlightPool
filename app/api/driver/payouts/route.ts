import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const isDriver = session.role === "DRIVER";
    const isAdmin = session.role === "ADMIN";

    if (!isDriver && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Driver or Admin access required." },
        { status: 403 }
      );
    }

    let targetDriverId = session.userId;
    if (isAdmin) {
      const url = new URL(req.url);
      const queryDriver = url.searchParams.get("driverId");
      if (queryDriver) targetDriverId = queryDriver;
    }

    // Resolve driver profile
    const driver = await prisma.driver.findFirst({
      where: {
        OR: [{ id: targetDriverId }, { phone: session.phone }],
      },
    });

    if (!driver) {
      return NextResponse.json({ payouts: [], totalEarnedPaise: 0 });
    }

    const payouts = await prisma.payout.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: "desc" },
    });

    const completedTrips = await prisma.trip.findMany({
      where: {
        driverId: driver.id,
        status: "COMPLETED",
      },
    });

    const totalEarnedPaise = Math.round(
      completedTrips.reduce((sum, t) => sum + (t.driverPayout || 0), 0) * 100
    );

    return NextResponse.json({
      driverId: driver.id,
      driverName: driver.name,
      totalEarnedPaise,
      payouts,
      completedTripsCount: completedTrips.length,
    });
  } catch (error: unknown) {
    console.error("Fetch payouts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver payouts", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const roleCheck = requireRole(req, ["ADMIN"]);
    if (roleCheck.response) return roleCheck.response;

    const body = await req.json();
    const { driverId, grossPaise } = body;

    if (!driverId || !grossPaise) {
      return NextResponse.json(
        { error: "driverId and grossPaise are required" },
        { status: 400 }
      );
    }

    const commissionPaise = Math.round(grossPaise * 0.15);
    const netPaise = grossPaise - commissionPaise;
    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const payout = await prisma.payout.create({
      data: {
        driverId,
        periodStart,
        periodEnd: now,
        grossPaise,
        commissionPaise,
        netPaise,
        status: "PAID",
        paidAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      payout,
      message: `Processed payout of ₹${netPaise / 100} to driver ${driverId}.`,
    });
  } catch (error: unknown) {
    console.error("Process payout error:", error);
    return NextResponse.json(
      { error: "Failed to process driver payout", details: String(error) },
      { status: 500 }
    );
  }
}
