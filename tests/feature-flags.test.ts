import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  calculateUserBucket,
  isFeatureEnabled,
  getAllFeatureFlags,
  getFeatureFlagDefinitions,
  updateFeatureFlag,
  resetFeatureFlagOverrides,
} from "../lib/config/feature-flags";
import { signSessionToken } from "../lib/auth";
import { NextRequest } from "next/server";

describe("Feature Flags & Experimentation Engine", () => {
  beforeEach(() => {
    resetFeatureFlagOverrides();
  });

  afterEach(() => {
    resetFeatureFlagOverrides();
  });

  describe("Deterministic Rollout Bucketing", () => {
    it("consistently computes the same bucket for the same user and flag", () => {
      const b1 = calculateUserBucket("TEST_FLAG", "user_123");
      const b2 = calculateUserBucket("TEST_FLAG", "user_123");
      expect(b1).toBe(b2);
      expect(b1).toBeGreaterThanOrEqual(0);
      expect(b1).toBeLessThan(100);
    });

    it("evaluates 100% rollout as always enabled", () => {
      expect(isFeatureEnabled("PRE_LANDING_QUEUE", { userId: "any_user_1" })).toBe(true);
      expect(isFeatureEnabled("PRE_LANDING_QUEUE", { userId: "any_user_2" })).toBe(true);
    });

    it("evaluates 0% rollout as disabled", () => {
      expect(isFeatureEnabled("EXPRESS_BAY_PRIORITY", { userId: "any_user" })).toBe(false);
    });

    it("enforces role restrictions on protected flags", () => {
      // EXPRESS_BAY_PRIORITY is restricted to ADMIN and MARSHAL
      expect(isFeatureEnabled("EXPRESS_BAY_PRIORITY", { role: "RIDER" })).toBe(false);
      expect(isFeatureEnabled("EXPRESS_BAY_PRIORITY", { role: "DRIVER" })).toBe(false);
    });

    it("dynamically applies runtime updates from updateFeatureFlag", () => {
      expect(isFeatureEnabled("EXPRESS_BAY_PRIORITY", { role: "ADMIN" })).toBe(false);

      updateFeatureFlag("EXPRESS_BAY_PRIORITY", { enabled: true, rolloutPercentage: 100 });
      expect(isFeatureEnabled("EXPRESS_BAY_PRIORITY", { role: "ADMIN" })).toBe(true);

      resetFeatureFlagOverrides();
      expect(isFeatureEnabled("EXPRESS_BAY_PRIORITY", { role: "ADMIN" })).toBe(false);
    });

    it("returns all evaluated feature flags and full definitions", () => {
      const allFlags = getAllFeatureFlags({ role: "ADMIN" });
      expect(allFlags.PRE_LANDING_QUEUE).toBe(true);
      expect(allFlags.WOMEN_ONLY_POOLS).toBe(true);

      const definitions = getFeatureFlagDefinitions();
      expect(definitions.length).toBeGreaterThanOrEqual(5);
      expect(definitions.some((d) => d.key === "DYNAMIC_SURGE_PRICING")).toBe(true);
    });
  });

  describe("API: /api/config/flags", () => {
    it("returns evaluated feature flags for anonymous clients", async () => {
      const { GET } = await import("../app/api/config/flags/route");
      const req = new NextRequest("http://localhost:3000/api/config/flags");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.flags).toBeDefined();
      expect(json.flags.PRE_LANDING_QUEUE).toBe(true);
      expect(json.authenticated).toBe(false);
    });
  });

  describe("API: /api/admin/flags RBAC & Updates", () => {
    const adminToken = signSessionToken({
      userId: "admin_flags_tester",
      role: "ADMIN",
      phone: "+919999999999",
    });

    const riderToken = signSessionToken({
      userId: "rider_flags_tester",
      role: "RIDER",
      phone: "+919911111111",
    });

    it("GET /api/admin/flags rejects unauthenticated request with 401", async () => {
      const { GET } = await import("../app/api/admin/flags/route");
      const req = new NextRequest("http://localhost:3000/api/admin/flags");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/flags rejects non-admin with 403", async () => {
      const { GET } = await import("../app/api/admin/flags/route");
      const req = new NextRequest("http://localhost:3000/api/admin/flags", {
        headers: { Authorization: `Bearer ${riderToken}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/flags succeeds for ADMIN with 200", async () => {
      const { GET } = await import("../app/api/admin/flags/route");
      const req = new NextRequest("http://localhost:3000/api/admin/flags", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.flags)).toBe(true);
      expect(json.flags.some((f: { key: string }) => f.key === "PRE_LANDING_QUEUE")).toBe(true);
    });

    it("PATCH /api/admin/flags rejects invalid rollout percentages with 400", async () => {
      const { PATCH } = await import("../app/api/admin/flags/route");
      const req = new NextRequest("http://localhost:3000/api/admin/flags", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          key: "PRE_LANDING_QUEUE",
          rolloutPercentage: 150, // Invalid: > 100
        }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("PATCH /api/admin/flags updates flag rollout at runtime for ADMIN", async () => {
      const { PATCH } = await import("../app/api/admin/flags/route");
      const req = new NextRequest("http://localhost:3000/api/admin/flags", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          key: "CASHFREE_GATEWAY",
          rolloutPercentage: 80,
          enabled: true,
        }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.flag.key).toBe("CASHFREE_GATEWAY");
      expect(json.flag.rolloutPercentage).toBe(80);
    });
  });
});
