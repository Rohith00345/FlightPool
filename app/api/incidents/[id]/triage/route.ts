import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roleCheck = requireRole(req, ["ADMIN", "MARSHAL", "SUPPORT"]);
    if (roleCheck.response) return roleCheck.response;

    const { id } = await params;
    const body = await req.json();
    const { status, resolutionNotes } = body;

    if (!status || !["RESOLVED", "INVESTIGATING", "ACTIVE"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status required: ACTIVE, INVESTIGATING, or RESOLVED" },
        { status: 400 }
      );
    }

    const resolvedAt = status === "RESOLVED" ? new Date() : null;

    const incident = await prisma.incident.update({
      where: { id },
      data: {
        status,
        resolvedAt,
        ...(resolutionNotes ? { description: { set: undefined } } : {}),
      },
    });

    if (incident.tripId && status === "RESOLVED") {
      await prisma.sosEvent.updateMany({
        where: { tripId: incident.tripId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      incidentId: incident.id,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
    });
  } catch (error: unknown) {
    console.error("Incident triage error:", error);
    return NextResponse.json(
      { error: "Failed to triage incident", details: String(error) },
      { status: 500 }
    );
  }
}
