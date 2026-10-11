import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth";
import {
  getFeatureFlagDefinitions,
  updateFeatureFlag,
} from "../../../../lib/config/feature-flags";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/flags
 * Retrieves full feature flag configurations and rollout parameters.
 * Protected: Requires ADMIN role.
 */
export async function GET(req: NextRequest) {
  try {
    const authCheck = requireRole(req, ["ADMIN"]);
    if (authCheck.response) {
      return authCheck.response;
    }

    const flags = getFeatureFlagDefinitions();
    return NextResponse.json({
      success: true,
      flags,
    });
  } catch (error) {
    console.error("Admin flags fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching flag configurations" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/flags
 * Dynamically updates feature flag rollout percentage or active status at runtime.
 * Protected: Requires ADMIN role.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authCheck = requireRole(req, ["ADMIN"]);
    if (authCheck.response) {
      return authCheck.response;
    }

    const body = await req.json().catch(() => ({}));
    const { key, enabled, rolloutPercentage } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Feature flag key is required." }, { status: 400 });
    }

    if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) {
      return NextResponse.json(
        { error: "rolloutPercentage must be an integer between 0 and 100." },
        { status: 400 }
      );
    }

    const updated = updateFeatureFlag(key, {
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(rolloutPercentage !== undefined ? { rolloutPercentage: Number(rolloutPercentage) } : {}),
    });

    return NextResponse.json({
      success: true,
      flag: updated,
    });
  } catch (error) {
    console.error("Admin flag update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error updating flag" },
      { status: 500 }
    );
  }
}
