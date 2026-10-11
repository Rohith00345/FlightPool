import { test, expect } from "@playwright/test";

const SMOKE_BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const SMOKE_ALLOW_WRITES = process.env.SMOKE_ALLOW_WRITES === "1" || process.env.SMOKE_ALLOW_WRITES === "true";

test.describe("FlightPool Universal Smoke Suite (Read-Only by default)", () => {
  test.use({ baseURL: SMOKE_BASE_URL });

  // 1. Health check & database connection
  test("1. GET /api/health responds with 200 and connected status", async ({ request }) => {
    const res = await request.get(`${SMOKE_BASE_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
  });

  // 2. Public pages load cleanly
  test("2. Public pages load successfully", async ({ page }) => {
    const pages = ["/", "/landing-wave", "/design"];
    for (const path of pages) {
      const response = await page.goto(`${SMOKE_BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("header")).toBeVisible();
    }
  });

  // 3. Public Flights API returns schedule
  test("3. GET /api/flights responds with flight schedules", async ({ request }) => {
    const res = await request.get(`${SMOKE_BASE_URL}/api/flights`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.flights)).toBe(true);
    expect(body.flights.length).toBeGreaterThan(0);
  });

  // 4. Protected APIs reject anonymous requests with 401
  test("4. Protected endpoints reject anonymous callers with 401", async ({ request }) => {
    const protectedEndpoints = [
      { url: `${SMOKE_BASE_URL}/api/admin/metrics`, method: "get" as const },
      { url: `${SMOKE_BASE_URL}/api/driver/queue`, method: "get" as const },
      { url: `${SMOKE_BASE_URL}/api/user/emergency-contacts`, method: "get" as const },
      { url: `${SMOKE_BASE_URL}/api/user/trips`, method: "get" as const },
      { url: `${SMOKE_BASE_URL}/api/pools/match`, method: "post" as const },
    ];

    for (const ep of protectedEndpoints) {
      const res = ep.method === "get" ? await request.get(ep.url) : await request.post(ep.url, { data: {} });
      expect([401, 403]).toContain(res.status());
    }
  });

  // 5. Write journey with demo personas (runs ONLY if SMOKE_ALLOW_WRITES=1 and target runs demo mode)
  test("5. Demo write journey (conditional on SMOKE_ALLOW_WRITES=1 and demo mode)", async ({ request }) => {
    if (!SMOKE_ALLOW_WRITES) {
      test.skip(true, "SMOKE_ALLOW_WRITES not enabled. Skipping write journey (read-only mode active).");
      return;
    }

    // Attempt demo authentication
    const authRes = await request.post(`${SMOKE_BASE_URL}/api/auth/otp`, {
      data: {
        identifier: "+919876543210",
        otp: "123456",
        name: "Pooja Sharma",
        role: "RIDER",
      },
    });

    if (authRes.status() !== 200) {
      test.skip(true, "Target environment is not running in demo mode (dev OTP rejected). Skipping write journey.");
      return;
    }

    const authJson = await authRes.json();
    expect(authJson.token).toBeDefined();

    const userId = authJson.user?.id || authJson.userId;
    const statusRes = await request.get(`${SMOKE_BASE_URL}/api/rides/status?userId=${userId}`, {
      headers: { Authorization: `Bearer ${authJson.token}` },
    });
    expect([200, 404]).toContain(statusRes.status());
  });
});
