import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, requireRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { tripId, poolId, type, description, severity } = body;

    if (!description) {
      return NextResponse.json(
        { error: "Description is required for reporting an incident." },
        { status: 400 }
      );
    }

    const incidentType = type || "SOS";
    const incidentSeverity = severity || "HIGH";

    const incident = await prisma.incident.create({
      data: {
        userId: session.userId,
        tripId: tripId || null,
        poolId: poolId || null,
        type: incidentType,
        description,
        severity: incidentSeverity,
        status: "ACTIVE",
      },
    });

    // If it's an SOS or high severity incident, also trigger an SosEvent
    if (incidentType === "SOS" || incidentSeverity === "HIGH") {
      await prisma.sosEvent.create({
        data: {
          userId: session.userId,
          tripId: tripId || null,
          severity: "S1",
          status: "OPEN",
        },
      });
    }

    return NextResponse.json({
      success: true,
      incidentId: incident.id,
      status: incident.status,
      message: "Incident reported and triaged immediately to safety response operations.",
    });
  } catch (error: unknown) {
    console.error("Incident report error:", error);
    return NextResponse.json(
      { error: "Failed to create incident report", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const roleCheck = requireRole(req, ["ADMIN", "MARSHAL"]);
    if (roleCheck.response) return roleCheck.response;

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "ACTIVE";

    const whereClause: Record<string, unknown> = {};
    if (status !== "ALL") {
      whereClause.status = status;
    }

    const incidents = await prisma.incident.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        trip: {
          include: {
            driver: { select: { name: true, phone: true } },
            vehicle: { select: { licensePlate: true, make: true, model: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ incidents });
  } catch (error: unknown) {
    console.error("Fetch incidents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents", details: String(error) },
      { status: 500 }
    );
  }
}
