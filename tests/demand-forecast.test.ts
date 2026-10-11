import { describe, it, expect } from "vitest";
import { computeCorridorDemandForecast } from "../lib/analytics/demand";
import { signSessionToken } from "../lib/auth";
import { NextRequest } from "next/server";

describe("Corridor Demand Forecast & Peak Wave Radar", () => {
  it("computes predictive corridor demand with wave groupings and driver recommendations", async () => {
    const forecast = await computeCorridorDemandForecast();

    expect(forecast.totalIncomingFlights).toBeGreaterThan(0);
    expect(forecast.forecastTime).toBeDefined();
    expect(forecast.peakWaveWindow).toBeDefined();
    expect(forecast.corridorSummary).toBeDefined();

    // Verify key Mumbai corridors are present
    expect(forecast.corridorSummary["Thane"]).toBeDefined();
    expect(forecast.corridorSummary["Powai"]).toBeDefined();
    expect(forecast.corridorSummary["Bandra"]).toBeDefined();
    expect(forecast.corridorSummary["Andheri"]).toBeDefined();

    if (forecast.hourlyWaves.length > 0) {
      const firstWave = forecast.hourlyWaves[0];
      expect(firstWave.flightCount).toBeGreaterThan(0);
      expect(firstWave.totalArrivalPassengers).toBeGreaterThan(0);
      expect(firstWave.corridors.length).toBeGreaterThan(0);

      const thaneCorridor = firstWave.corridors.find((c) => c.zone === "Thane");
      expect(thaneCorridor).toBeDefined();
      expect(thaneCorridor!.recommendedDriverPositioning).toBeGreaterThanOrEqual(1);
    }
  });

  describe("API: /api/admin/demand-forecast RBAC", () => {
    it("rejects unauthenticated request with 401", async () => {
      const { GET } = await import("../app/api/admin/demand-forecast/route");
      const req = new NextRequest("http://localhost:3000/api/admin/demand-forecast");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("rejects non-admin (RIDER) role with 403", async () => {
      const riderToken = signSessionToken({
        userId: "rider_test_uid",
        role: "RIDER",
        phone: "+919900000001",
      });

      const { GET } = await import("../app/api/admin/demand-forecast/route");
      const req = new NextRequest("http://localhost:3000/api/admin/demand-forecast", {
        headers: { Authorization: `Bearer ${riderToken}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it("allows ADMIN role with 200 and returns forecast", async () => {
      const adminToken = signSessionToken({
        userId: "admin_test_uid",
        role: "ADMIN",
        phone: "+919999999999",
      });

      const { GET } = await import("../app/api/admin/demand-forecast/route");
      const req = new NextRequest("http://localhost:3000/api/admin/demand-forecast", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.forecast).toBeDefined();
      expect(json.forecast.corridorSummary).toBeDefined();
    });
  });
});
