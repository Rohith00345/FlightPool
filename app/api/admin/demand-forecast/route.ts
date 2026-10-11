import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth";
import { computeCorridorDemandForecast } from "../../../../lib/analytics/demand";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/demand-forecast
 * Returns predictive corridor demand forecasting and peak arrival wave supply recommendations.
 * Protected: Requires ADMIN role.
 */
export async function GET(req: NextRequest) {
  try {
    const authCheck = requireRole(req, ["ADMIN"]);
    if (authCheck.response) {
      return authCheck.response;
    }

    const forecast = await computeCorridorDemandForecast();
    return NextResponse.json({
      success: true,
      forecast,
    });
  } catch (error) {
    console.error("Demand forecast error:", error);
    return NextResponse.json(
      { error: "Internal server error computing demand forecast" },
      { status: 500 }
    );
  }
}
