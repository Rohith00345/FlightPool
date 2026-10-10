import { NextRequest, NextResponse } from "next/server";
import { runRetentionJob } from "@/lib/retention";

/**
 * Scheduled Cron Endpoint for Automated Data Retention Purging.
 * Protected strictly by CRON_SECRET header verification.
 */
export async function POST(req: NextRequest) {
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

    const result = await runRetentionJob();

    return NextResponse.json({
      success: true,
      message: "Data retention policy executed successfully.",
      result,
    });
  } catch (error: unknown) {
    console.error("Cron retention error:", error);
    return NextResponse.json(
      { error: "Retention job execution failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

