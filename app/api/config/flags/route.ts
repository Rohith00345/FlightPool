import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import { getAllFeatureFlags } from "../../../../lib/config/feature-flags";

export const dynamic = "force-dynamic";

/**
 * GET /api/config/flags
 * Returns evaluated feature flag states for the current client or authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const flags = getAllFeatureFlags({
      userId: session?.userId,
      role: session?.role,
    });

    return NextResponse.json({
      success: true,
      flags,
      authenticated: !!session,
    });
  } catch (error) {
    console.error("Flags evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error evaluating flags" },
      { status: 500 }
    );
  }
}
