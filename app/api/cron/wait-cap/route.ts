import { NextRequest, NextResponse } from "next/server";
import { processWaitCapExpiries } from "@/lib/pool-engine";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: If CRON_SECRET is not configured or token does not match
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing CRON_SECRET authorization." },
        { status: 401 }
      );
    }

    const result = await processWaitCapExpiries(new Date());

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: unknown) {
    console.error("Wait-cap cron error:", error);
    return NextResponse.json(
      { error: "Cron execution failed", details: String(error) },
      { status: 500 }
    );
  }
}
