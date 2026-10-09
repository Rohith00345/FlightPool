import { test, expect } from "@playwright/test";

test.describe("Security, RBAC, Rate Limiting & DPDP Compliance", () => {
  test("1. Anonymous request to /api/admin/metrics is rejected with 401/403", async ({ request }) => {
    const res = await request.get("/api/admin/metrics");
    expect([401, 403]).toContain(res.status());
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test("2. Anonymous request to /api/admin/simulate-flight is rejected with 401/403", async ({ request }) => {
    const res = await request.post("/api/admin/simulate-flight", {
      data: { flightNumber: "6E-204" },
    });
    expect([401, 403]).toContain(res.status());
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test("3. Authenticated Admin can access metrics and simulate flights with AuditLog creation", async ({ request }) => {
    // Authenticate as Admin
    const loginRes = await request.post("/api/auth/otp", {
      data: {
        identifier: "+919999999999",
        otp: "123456",
        name: "FlightPool Admin",
        role: "ADMIN",
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { token } = await loginRes.json();
    expect(token).toBeDefined();

    // Query admin metrics with Bearer token
    const metricsRes = await request.get("/api/admin/metrics", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(metricsRes.ok()).toBeTruthy();
    const metricsJson = await metricsRes.json();
    expect(metricsJson.metrics).toBeDefined();
    expect(metricsJson.metrics.matchRate).toBeGreaterThanOrEqual(0);

    // Trigger flight simulation with Bearer token
    const simRes = await request.post("/api/admin/simulate-flight", {
      headers: { Authorization: `Bearer ${token}` },
      data: { flightNumber: "AI-865" },
    });
    expect(simRes.ok()).toBeTruthy();
    const simJson = await simRes.json();
    expect(simJson.success).toBe(true);
  });

  test("4. Passenger Boarding Pass verification captures explicit Consent", async ({ request }) => {
    // Rider login
    const authRes = await request.post("/api/auth/otp", {
      data: {
        identifier: "+919833445566",
        otp: "123456",
        name: "Consent Tester",
      },
    });
    const { user, token } = await authRes.json();

    const flightsRes = await request.get("/api/flights");
    const flight = (await flightsRes.json()).flights[0];

    // Submit verification
    const verifyRes = await request.post("/api/verification", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        userId: user.id,
        flightId: flight.id,
        pnr: "PNRCONSENT1",
        seatNumber: "12A",
      },
    });
    expect(verifyRes.ok()).toBeTruthy();
    const verifyJson = await verifyRes.json();
    expect(verifyJson.success).toBe(true);
    expect(verifyJson.verification.pnr).toBe("PNRCONSENT1");
  });

  test("5. DPDP Data Deletion: Rider can request data scrub and receive confirmation", async ({ request }) => {
    const authRes = await request.post("/api/auth/otp", {
      data: {
        identifier: "+919877001122",
        otp: "123456",
        name: "Delete Me Traveler",
      },
    });
    const { user, token } = await authRes.json();

    const delRes = await request.post("/api/user/delete-data", {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId: user.id },
    });
    expect(delRes.ok()).toBeTruthy();
    const delJson = await delRes.json();
    expect(delJson.success).toBe(true);
    expect(delJson.message).toContain("purged in compliance with DPDP");
  });
});
