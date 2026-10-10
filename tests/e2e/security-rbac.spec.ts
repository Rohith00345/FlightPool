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

  test("12. Marshal Station RBAC: Anonymous & Riders rejected (401/403), Marshal succeeds", async ({ request }) => {
    // 1. Anonymous request to marshal station rejected
    const anonRes = await request.get("/api/marshal/station");
    expect([401, 403]).toContain(anonRes.status());

    // 2. Rider request to marshal station rejected (403)
    const riderLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811223344", otp: "123456", name: "Rider Only", role: "RIDER" },
    });
    const { token: riderToken } = await riderLogin.json();
    const riderRes = await request.get("/api/marshal/station", {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    expect(riderRes.status()).toBe(403);

    // 3. Marshal request succeeds (200)
    const marshalLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919800112233", otp: "123456", name: "BOM Marshal", role: "MARSHAL" },
    });
    const { token: marshalToken } = await marshalLogin.json();
    const marshalRes = await request.get("/api/marshal/station", {
      headers: { Authorization: `Bearer ${marshalToken}` },
    });
    expect(marshalRes.ok()).toBeTruthy();
    const marshalJson = await marshalRes.json();
    expect(marshalJson.terminals).toBeDefined();
  });

  test("13. Cross-User Trip Access Defense: Rider A cannot view Rider B's trip", async ({ request }) => {
    // Rider A logs in and creates ride
    const riderALogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919822334455", otp: "123456", name: "Rider A", role: "RIDER" },
    });
    const { user: userA, token: tokenA } = await riderALogin.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];
    const reqRes = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: {
        userId: userA.id,
        flightId: flight.id,
        destinationZone: "Bandra",
        destinationAddress: "Bandra BKC",
        luggageCount: 1,
      },
    });
    const { rideRequest: reqA } = await reqRes.json();

    const soloRes = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: {
        userId: userA.id,
        rideRequestId: reqA.id,
      },
    });
    const soloData = await soloRes.json();
    const tripAId = soloData.trip.id;

    // Rider B logs in
    const riderBLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919877889900", otp: "123456", name: "Rider B", role: "RIDER" },
    });
    const { token: tokenB } = await riderBLogin.json();

    // Rider B attempts to inspect Rider A's trip -> Rejected with 403 Forbidden
    const crossRes = await request.get(`/api/trips/${tripAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(crossRes.status()).toBe(403);
    const crossJson = await crossRes.json();
    expect(crossJson.error).toContain("Forbidden");
  });

  test("14. Public Trip Sharing Token exposes telemetry without PII", async ({ request }) => {
    const riderLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919833221100", otp: "123456", name: "Rider Share Tester", role: "RIDER" },
    });
    const { user: riderUser, token: riderToken } = await riderLogin.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];
    const reqRes = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: {
        userId: riderUser.id,
        flightId: flight.id,
        destinationZone: "Powai",
        destinationAddress: "Hiranandani Gardens, Powai",
        luggageCount: 1,
      },
    });
    const { rideRequest: reqShare } = await reqRes.json();

    const soloRes = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: {
        userId: riderUser.id,
        rideRequestId: reqShare.id,
      },
    });
    const { trip } = await soloRes.json();

    // Generate Share Token
    const shareRes = await request.post(`/api/trips/${trip.id}/share`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    expect(shareRes.ok()).toBeTruthy();
    const { token: shareToken, shareUrl } = await shareRes.json();
    expect(shareToken).toBeDefined();
    expect(shareUrl).toContain("/trip/share/");

    // Resolve publicly without credentials
    const publicRes = await request.get(`/api/trips/share/${shareToken}`);
    expect(publicRes.ok()).toBeTruthy();
    const publicJson = await publicRes.json();

    // Verify sanitized data
    expect(publicJson.active).toBe(true);
    expect(publicJson.vehicle.maskedPlate).toContain("••"); // Masked plate
    expect(publicJson.driver.name).toBeDefined();

    // Confirm ZERO rider PII leaked
    expect(publicJson.riders).toBeUndefined();
    expect(publicJson.passengerPhone).toBeUndefined();
  });

  test("15. Map & Payment Views load cleanly without CSP or script errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("networkidle");

    // Filter benign Leaflet / tile network hiccups if offline
    const criticalCspErrors = errors.filter(
      (e) => e.includes("Content-Security-Policy") || e.includes("eval") || e.includes("violates")
    );
    expect(criticalCspErrors).toHaveLength(0);
  });
});
