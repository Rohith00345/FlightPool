import { test, expect } from "@playwright/test";
import { signSessionToken } from "../../lib/auth";

const PROD_URL = "http://localhost:3001";

test.describe("Production Mode Fail-Closed Security Suite (Port 3001)", () => {
  // 1. Dev OTP 123456 must be rejected on production
  test("1. Dev OTP 123456 is strictly rejected in production mode", async ({ request }) => {
    // Attempt login with 123456
    const res = await request.post(`${PROD_URL}/api/auth/otp`, {
      data: {
        identifier: "+919877000001",
        otp: "123456",
        name: "Prod User",
      },
    });

    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Production mode active: Live SMS verification provider required");

    // OTP request must NOT return dev otpHint
    const reqRes = await request.post(`${PROD_URL}/api/auth/otp`, {
      data: {
        identifier: "+919877000002",
      },
    });
    expect(reqRes.ok()).toBeTruthy();
    const reqJson = await reqRes.json();
    expect(reqJson.otpHint).toBeUndefined();
    expect(reqJson.message).not.toContain("123456");
  });

  // 2. Homepage UI: No persona cards, no dev badge, empty OTP input, clean placeholder
  test("2. Homepage gates persona cards, dev badge, and OTP defaults in production", async ({ page }) => {
    await page.goto(`${PROD_URL}/`);

    // Verify page loaded
    await expect(page.locator("header")).toBeVisible();

    // Verify persona cards are NOT rendered
    await expect(page.locator("text=Select Test Persona")).toHaveCount(0);
    await expect(page.locator("text=Aarav Sharma")).toHaveCount(0);
    await expect(page.locator("text=Priya Nair")).toHaveCount(0);

    // Verify Dev OTP badge is NOT rendered
    await expect(page.locator("text=Dev OTP: 123456")).toHaveCount(0);

    // Verify OTP input placeholder and value
    const otpInput = page.locator('input[placeholder="Enter 6-digit OTP"]');
    await expect(otpInput).toBeVisible();
    await expect(otpInput).toHaveValue("");

    // Verify 123456 is NOT the placeholder
    await expect(page.locator('input[placeholder="123456"]')).toHaveCount(0);
  });

  // 3. Admin Page: No persona quick sign-in button
  test("3. Admin page does not render demo persona login in production", async ({ page }) => {
    await page.goto(`${PROD_URL}/admin`);

    await expect(page.locator("text=Admin Authentication Required")).toBeVisible();
    await expect(page.locator("text=Sign In as FlightPool Admin (Demo Persona)")).toHaveCount(0);
  });

  // 4. Driver Page: No persona quick sign-in button, hardware notice present
  test("4. Driver page does not render demo persona login in production", async ({ page }) => {
    await page.goto(`${PROD_URL}/driver`);

    await expect(page.locator("text=Driver Sign-In Required")).toBeVisible();
    await expect(page.locator("text=Sign In as Ramesh Shinde (Demo Persona)")).toHaveCount(0);
    await expect(page.locator("text=Production Mode Active: Driver hardware/token auth required.")).toBeVisible();
  });

  // 5. Zero header-based backdoor bypass (x-demo-role / x-demo-user-id rejected)
  test("5. x-demo-role and x-demo-user-id headers are completely ignored and return 401", async ({ request }) => {
    // Attempt Admin metrics access with forged demo headers
    const metricsRes = await request.get(`${PROD_URL}/api/admin/metrics`, {
      headers: {
        "x-demo-role": "ADMIN",
        "x-demo-user-id": "demo-admin-id",
      },
    });
    expect(metricsRes.status()).toBe(401);
    const metricsJson = await metricsRes.json();
    expect(metricsJson.error).toBe("Authentication required");

    // Attempt simulate flight with forged headers
    const simRes = await request.post(`${PROD_URL}/api/admin/simulate-flight`, {
      headers: {
        "x-demo-role": "ADMIN",
        "x-demo-user-id": "demo-admin-id",
      },
      data: { flightNumber: "6E-204" },
    });
    expect(simRes.status()).toBe(401);

    // Attempt driver trips with forged headers
    const driverRes = await request.get(`${PROD_URL}/api/driver/trips`, {
      headers: {
        "x-demo-role": "DRIVER",
        "x-demo-user-id": "demo-driver-id",
      },
    });
    expect(driverRes.status()).toBe(401);
  });

  // 6. Flight simulation returns 403 even for authenticated Admin when DEMO_MODE is off
  test("6. simulate-flight returns 403 even for authenticated Admin in production mode", async ({ request }) => {
    // Generate valid signed ADMIN session token
    const adminToken = signSessionToken({
      userId: "admin-production-uid",
      role: "ADMIN",
      phone: "+919999999999",
      name: "Production Admin",
    });

    // Verify token can access regular admin metrics (auth works)
    const metricsRes = await request.get(`${PROD_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(metricsRes.ok()).toBeTruthy();

    // Flight simulation MUST still return 403 Forbidden
    const simRes = await request.post(`${PROD_URL}/api/admin/simulate-flight`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        flightNumber: "6E-204",
        delayMinutes: 30,
      },
    });

    expect(simRes.status()).toBe(403);
    const simJson = await simRes.json();
    expect(simJson.error).toBe("Forbidden");
    expect(simJson.message).toBe("Flight simulation is only permitted when DEMO_MODE=true");
  });
});
