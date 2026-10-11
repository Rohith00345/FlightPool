import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import {
  joinDriverQueue,
  getDriverQueueStatus,
  leaveDriverQueue,
} from "../../../../lib/driver-queue";

export const dynamic = "force-dynamic";

/**
 * POST /api/driver/queue
 * Driver joins the virtual airport staging queue.
 * Requires driver role, assigned commercial vehicle, and verified GPS inside the 2.5km airport geofence.
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = requireRole(req, ["DRIVER", "ADMIN"]);
    if (authCheck.response) return authCheck.response;
    const session = authCheck.session!;

    const body = await req.json();
    const { lat, lng, preferredTerminal } = body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "Valid latitude and longitude coordinates are required" },
        { status: 400 }
      );
    }

    if (preferredTerminal && !["T1", "T2"].includes(preferredTerminal)) {
      return NextResponse.json(
        { error: "Invalid terminal code. Must be T1 or T2" },
        { status: 400 }
      );
    }

    // Lookup driver profile with vehicle
    const driver = await prisma.driver.findFirst({
      where: session.role === "DRIVER" ? { phone: session.phone } : undefined,
      include: { vehicle: true },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver profile not found or not active" },
        { status: 404 }
      );
    }

    if (!driver.vehicle) {
      return NextResponse.json(
        { error: "No vehicle assigned. Verified commercial vehicle required for airport staging" },
        { status: 422 }
      );
    }

    const queueResult = await joinDriverQueue({
      driverId: driver.id,
      driverName: driver.name,
      phone: driver.phone,
      vehiclePlate: driver.vehicle.licensePlate,
      terminalCode: preferredTerminal as "T1" | "T2" | undefined,
      lat,
      lng,
    });

    if (!queueResult.success) {
      return NextResponse.json(
        { error: queueResult.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Checked into ${queueResult.terminalCode} virtual queue`,
      driverId: driver.id,
      position: queueResult.position,
      totalInQueue: queueResult.totalInQueue,
      estimatedWaitMin: queueResult.estimatedWaitMin,
      assignedBay: queueResult.assignedBay,
      terminalCode: queueResult.terminalCode,
    });
  } catch (error) {
    console.error("Driver queue join error:", error);
    return NextResponse.json(
      { error: "Internal server error joining driver queue" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/driver/queue
 * Returns current driver's queue position and telemetry.
 */
export async function GET(req: NextRequest) {
  try {
    const authCheck = requireRole(req, ["DRIVER", "ADMIN"]);
    if (authCheck.response) return authCheck.response;
    const session = authCheck.session!;

    const driver = await prisma.driver.findFirst({
      where: session.role === "DRIVER" ? { phone: session.phone } : undefined,
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver profile not found" },
        { status: 404 }
      );
    }

    const status = await getDriverQueueStatus(driver.id);

    return NextResponse.json({
      success: true,
      driverId: driver.id,
      ...status,
    });
  } catch (error) {
    console.error("Driver queue status error:", error);
    return NextResponse.json(
      { error: "Internal server error querying driver queue" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/driver/queue
 * Driver exits the virtual queue.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authCheck = requireRole(req, ["DRIVER", "ADMIN"]);
    if (authCheck.response) return authCheck.response;
    const session = authCheck.session!;

    const driver = await prisma.driver.findFirst({
      where: session.role === "DRIVER" ? { phone: session.phone } : undefined,
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver profile not found" },
        { status: 404 }
      );
    }

    const result = await leaveDriverQueue(driver.id);

    return NextResponse.json({
      success: true,
      message: result.success ? "Exited virtual queue" : "Driver was not in queue",
      driverId: driver.id,
    });
  } catch (error) {
    console.error("Driver queue leave error:", error);
    return NextResponse.json(
      { error: "Internal server error leaving driver queue" },
      { status: 500 }
    );
  }
}
