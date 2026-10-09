import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { runRetentionJob } from "@/lib/retention";

export async function POST(req: NextRequest) {
  // Allow authorization via Bearer token (ADMIN role) or matching CRON_SECRET
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const configuredSecret = process.env.CRON_SECRET;

  const isCronAuthorized = configuredSecret && cronSecretHeader === configuredSecret;
  if (!isCronAuthorized) {
    const auth = requireRole(req, ["ADMIN"]);
    if (auth.response) {
      return auth.response;
    }
  }

  try {
    const result = await runRetentionJob();
    return NextResponse.json({
      success: true,
      message: "Retention purge completed successfully",
      ...result,
    });
  } catch (error: unknown) {
    console.error("Retention API error:", error);
    return NextResponse.json(
      { error: "Retention job failed", details: String(error) },
      { status: 500 }
    );
  }
}
