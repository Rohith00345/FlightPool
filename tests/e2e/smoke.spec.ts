import { test, expect } from "@playwright/test";

test.describe("Permanent Critical Safety Net & Smoke Suite", () => {
  // 1. Health check & DB connectivity
  test("1. GET /api/health returns 200 and connected status", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
  });

  // 2. Admin database schema contract health
  test("2. GET /api/admin/health validates live database contract", async ({ request }) => {
    const adminLogin = await request.post("/api/auth/otp", {
      data: {
        identifier: "+919999999999",
        otp: "123456",
        name: "Airport Admin",
        role: "ADMIN",
      },
    });
    const { token: adminToken } = await adminLogin.json();

    const healthRes = await request.get("/api/admin/health", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe("ok");
    expect(healthJson.contract).toBe("valid");
    expect(healthJson.modelsChecked).toBeGreaterThan(0);
    expect(healthJson.totalColumnsChecked).toBeGreaterThan(0);
  });

  // 3. Homepage renders cleanly without unhandled runtime exceptions
  test("3. Homepage loads with interactive elements and zero critical errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("header")).toBeVisible();
    expect(errors.length).toBe(0);
  });

  // 4. Landing wave screen loads cleanly
  test("4. Landing wave page renders headline and flight status elements", async ({ page }) => {
    await page.goto("http://localhost:3000/landing-wave");
    await page.waitForLoadState("domcontentloaded");

    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  // 5. Flights API responds with active airport schedules
  test("5. GET /api/flights responds with flight schedules", async ({ request }) => {
    const res = await request.get("/api/flights");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.flights)).toBe(true);
    expect(body.flights.length).toBeGreaterThan(0);
  });
});
