import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { handleFlightStatusChange } from "@/lib/pool-engine";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const cronHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isCronAuthorized = cronSecret && cronHeader === `Bearer ${cronSecret}`;
    const isAdmin = session && session.role === "ADMIN";

    if (!isCronAuthorized && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin or authorized service access required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { flightNumber, status, delayMinutes } = body;

    if (!flightNumber || !status) {
      return NextResponse.json(
        { error: "Missing required fields: flightNumber, status" },
        { status: 400 }
      );
    }

    const result = await handleFlightStatusChange({
      flightNumber,
      newStatus: status,
      delayMinutes: typeof delayMinutes === "number" ? delayMinutes : undefined,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error("Flight update error:", error);
    return NextResponse.json(
      { error: "Failed to update flight status", details: String(error) },
      { status: 500 }
    );
  }
}
