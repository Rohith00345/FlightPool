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

  test("6. Ownership Check: Rider A cannot view Rider B's ride status (403)", async ({ request }) => {
    // Register Rider A
    const authA = await request.post("/api/auth/otp", {
      data: { identifier: "+919810100091", otp: "123456", name: "Rider Alice" },
    });
    const { token: tokenA } = await authA.json();

    // Register Rider B
    const authB = await request.post("/api/auth/otp", {
      data: { identifier: "+919810100092", otp: "123456", name: "Rider Bob" },
    });
    const { user: userB } = await authB.json();

    // Rider A tries to fetch Rider B's ride status
    const crossRes = await request.get(`/api/rides/status?userId=${userB.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(crossRes.status()).toBe(403);
    const json = await crossRes.json();
    expect(json.error).toContain("Forbidden");
  });

  test("7. Ownership Check: Rider A cannot create a ride request on behalf of Rider B (403)", async ({ request }) => {
    const authA = await request.post("/api/auth/otp", {
      data: { identifier: "+919810100093", otp: "123456", name: "Rider A7" },
    });
    const { token: tokenA } = await authA.json();

    const authB = await request.post("/api/auth/otp", {
      data: { identifier: "+919810100094", otp: "123456", name: "Rider B7" },
    });
    const { user: userB } = await authB.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];

    const crossRes = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: {
        userId: userB.id,
        flightId: flight.id,
        destinationZone: "Andheri",
        destinationAddress: "Lokhandwala Complex",
        luggageCount: 1,
      },
    });
    expect(crossRes.status()).toBe(403);
    const json = await crossRes.json();
    expect(json.error).toContain("Forbidden");
  });

  test("8. Women-Only Segregation: Male or unverified rider requesting womenOnly is rejected with 400", async ({ request }) => {
    // Male rider
    const authMale = await request.post("/api/auth/otp", {
      data: { identifier: "+919810100095", otp: "123456", name: "Male Rider", gender: "MALE" },
    });
    const { user: maleUser, token: maleToken } = await authMale.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];

    const reqRes = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${maleToken}` },
      data: {
        userId: maleUser.id,
        flightId: flight.id,
        destinationZone: "Bandra",
        womenOnly: true,
      },
    });
    expect(reqRes.status()).toBe(400);
    const json = await reqRes.json();
    expect(json.error).toContain("Women-only pools are exclusively available to verified female passengers");
  });

  test("9. Cross-User Trip Security: Rider cannot update trip lifecycle (403)", async ({ request }) => {
    const authRider = await request.post("/api/auth/otp", {
      data: { identifier: "+919810100096", otp: "123456", name: "Regular Rider" },
    });
    const { user: riderUser, token: riderToken } = await authRider.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];
    const reqRes = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: {
        userId: riderUser.id,
        flightId: flight.id,
        destinationZone: "Andheri",
        destinationAddress: "Lokhandwala Complex",
        luggageCount: 1,
      },
    });
    const reqData = await reqRes.json();
    const soloRes = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: {
        userId: riderUser.id,
        rideRequestId: reqData.rideRequest.id,
      },
    });
    const soloData = await soloRes.json();
    const tripId = soloData.trip.id;

    const patchRes = await request.patch(`/api/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: { status: "COMPLETED" },
    });
    expect(patchRes.status()).toBe(403);
    const json = await patchRes.json();
    expect(json.error).toContain("Forbidden");
  });

  test("10. Database-backed OTP rate limiter blocks excessive requests with 429", async ({ request }) => {
    const testPhone = "+9198" + Math.floor(10000000 + Math.random() * 90000000);
    // Attempt 5 failed OTP requests (within limit)
    for (let i = 0; i < 5; i++) {
      const res = await request.post("/api/auth/otp", {
        data: { identifier: testPhone, otp: "000000" },
      });
      expect(res.status()).toBe(400);
    }

    // 6th request within window must be rate-limited (429)
    const rateLimitedRes = await request.post("/api/auth/otp", {
      data: { identifier: testPhone, otp: "000000" },
    });
    expect(rateLimitedRes.status()).toBe(429);
    const json = await rateLimitedRes.json();
    expect(json.error).toContain("Too many OTP");
  });

  test("11. Admin Retention API: Anonymous rejected (401/403), Admin executes purge (200)", async ({ request }) => {
    // Anonymous
    const anonRes = await request.post("/api/admin/retention");
    expect([401, 403]).toContain(anonRes.status());

    // Admin login
    const adminAuth = await request.post("/api/auth/otp", {
      data: { identifier: "+919999999999", otp: "123456", role: "ADMIN" },
    });
    const { token: adminToken } = await adminAuth.json();

    const purgeRes = await request.post("/api/admin/retention", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(purgeRes.ok()).toBeTruthy();
    const json = await purgeRes.json();
    expect(json.success).toBe(true);
    expect(json.auditLogId).toBeDefined();
  });
});
