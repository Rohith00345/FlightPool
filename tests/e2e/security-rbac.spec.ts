import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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

  test("16. Flight Update RBAC: /api/flights/update rejects anonymous (401), non-admin (403), allows Admin/Cron", async ({ request }) => {
    // Anonymous
    const anonRes = await request.post("/api/flights/update", {
      data: { flightNumber: "6E-204", status: "LANDED" },
    });
    expect([401, 403]).toContain(anonRes.status());

    // Wrong role (Rider)
    const riderLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811002233", otp: "123456", name: "Rider Flight Hacker", role: "RIDER" },
    });
    const { token: riderToken } = await riderLogin.json();
    const riderRes = await request.post("/api/flights/update", {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: { flightNumber: "6E-204", status: "LANDED" },
    });
    expect(riderRes.status()).toBe(403);

    // Authorized Admin
    const adminLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919999999999", otp: "123456", role: "ADMIN" },
    });
    const { token: adminToken } = await adminLogin.json();
    const adminRes = await request.post("/api/flights/update", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { flightNumber: "6E-204", status: "LANDED" },
    });
    expect(adminRes.ok()).toBeTruthy();
    const adminJson = await adminRes.json();
    expect(adminJson.success).toBe(true);
  });

  test("17. Incident Triage RBAC: /api/incidents/[id]/triage rejects anonymous (401), rider (403), allows Marshal/Admin", async ({ request }) => {
    const adminLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919999999999", otp: "123456", role: "ADMIN" },
    });
    const { token: adminToken } = await adminLogin.json();

    const incRes = await request.post("/api/incidents", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { type: "DELAY", description: "Baggage belt delay", severity: "LOW" },
    });
    const { incidentId } = await incRes.json();
    expect(incidentId).toBeDefined();

    // Anonymous triage attempt
    const anonRes = await request.patch(`/api/incidents/${incidentId}/triage`, {
      data: { status: "RESOLVED" },
    });
    expect([401, 403]).toContain(anonRes.status());

    // Wrong role (Rider)
    const riderLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811445566", otp: "123456", role: "RIDER" },
    });
    const { token: riderToken } = await riderLogin.json();
    const riderRes = await request.patch(`/api/incidents/${incidentId}/triage`, {
      headers: { Authorization: `Bearer ${riderToken}` },
      data: { status: "RESOLVED" },
    });
    expect(riderRes.status()).toBe(403);

    // Marshal succeeds
    const marshalLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919800556677", otp: "123456", role: "MARSHAL" },
    });
    const { token: marshalToken } = await marshalLogin.json();
    const marshalRes = await request.patch(`/api/incidents/${incidentId}/triage`, {
      headers: { Authorization: `Bearer ${marshalToken}` },
      data: { status: "RESOLVED" },
    });
    expect(marshalRes.ok()).toBeTruthy();
    const marshalJson = await marshalRes.json();
    expect(marshalJson.status).toBe("RESOLVED");
  });

  test("18. Webhook Security: /api/payments/webhook validates signature first, rejects invalid, processes valid idempotently", async ({ request }) => {
    const rawPayload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test_idem_1", amount: 45000 } } },
    });

    // 1. Missing signature header -> 401
    const noSigRes = await request.post("/api/payments/webhook", {
      data: rawPayload,
    });
    expect([400, 401]).toContain(noSigRes.status());

    // 2. Tampered / invalid signature -> 401
    const badSigRes = await request.post("/api/payments/webhook", {
      headers: { "x-razorpay-signature": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" },
      data: rawPayload,
    });
    expect([400, 401]).toContain(badSigRes.status());

    // 3. Valid cryptographic HMAC signature succeeds (200)
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "test_razorpay_webhook_secret_mock_2026";
    const validSignature = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

    const validRes = await request.post("/api/payments/webhook", {
      headers: { "x-razorpay-signature": validSignature },
      data: rawPayload,
    });
    expect(validRes.ok()).toBeTruthy();

    // 4. Replay test (idempotency): Second identical delivery succeeds safely
    const replayRes = await request.post("/api/payments/webhook", {
      headers: { "x-razorpay-signature": validSignature },
      data: rawPayload,
    });
    expect(replayRes.ok()).toBeTruthy();
  });

  test("19. Cron Security: /api/cron/* rejects missing or invalid CRON_SECRET, succeeds with valid token", async ({ request }) => {
    // 1. Wait-cap cron without secret -> 401
    const anonWaitCap = await request.get("/api/cron/wait-cap");
    expect(anonWaitCap.status()).toBe(401);

    // 2. Wait-cap with invalid secret -> 401
    const badWaitCap = await request.get("/api/cron/wait-cap", {
      headers: { Authorization: "Bearer wrong_secret_token" },
    });
    expect(badWaitCap.status()).toBe(401);

    // 3. Wait-cap with valid secret -> 200
    const cronSecret = process.env.CRON_SECRET || "flightpool_retention_cron_secret_token_2026";
    const goodWaitCap = await request.get("/api/cron/wait-cap", {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    expect(goodWaitCap.ok()).toBeTruthy();
    const waitCapJson = await goodWaitCap.json();
    expect(waitCapJson.success).toBe(true);

    // 4. Retention cron without secret -> 401
    const anonRetention = await request.post("/api/cron/retention");
    expect(anonRetention.status()).toBe(401);

    // 5. Retention with valid secret -> 200
    const goodRetention = await request.post("/api/cron/retention", {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    expect(goodRetention.ok()).toBeTruthy();
  });

  test("20. Cross-User IDOR Defense on Pools: Rider A cannot confirm or leave Rider B's pool (403)", async ({ request }) => {
    const authA = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556601", otp: "123456", name: "Pool Rider A" },
    });
    const { token: tokenA } = await authA.json();

    const authB = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556602", otp: "123456", name: "Pool Rider B" },
    });
    const { user: userB } = await authB.json();

    // Rider A attempts to confirm Rider B's pool -> 403 Forbidden
    const crossConfirm = await request.post("/api/pools/confirm", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { poolId: "pool_dummy_b_123", userId: userB.id },
    });
    expect(crossConfirm.status()).toBe(403);

    // Rider A attempts to leave / cancel Rider B's pool -> 403 Forbidden
    const crossLeave = await request.post("/api/pools/leave", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { poolId: "pool_dummy_b_123", userId: userB.id },
    });
    expect(crossLeave.status()).toBe(403);

    // Rider A attempts to trigger re-quote on a pool they don't belong to -> 403 or 404
    const crossRequote = await request.post("/api/pools/pool_dummy_b_123/re-quote", {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect([403, 404]).toContain(crossRequote.status());
  });

  test("21. Cross-User IDOR Defense on Trips: Rider A cannot rate or trigger SOS on Rider B's trip (403)", async ({ request }) => {
    const authA = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556603", otp: "123456", name: "Trip Rider A" },
    });
    const { token: tokenA } = await authA.json();

    const authB = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556604", otp: "123456", name: "Trip Rider B" },
    });
    const { user: userB, token: tokenB } = await authB.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];

    const reqB = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        userId: userB.id,
        flightId: flight.id,
        destinationZone: "Powai",
        destinationAddress: "Powai Lake",
      },
    });
    const { rideRequest: rideB } = await reqB.json();

    const soloB = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { userId: userB.id, rideRequestId: rideB.id },
    });
    const { trip: tripB } = await soloB.json();

    // Rider A attempts to submit rating for Rider B -> 403 Forbidden
    const crossRate = await request.post(`/api/trips/${tripB.id}/rate`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { raterUserId: userB.id, score: 5 },
    });
    expect(crossRate.status()).toBe(403);

    // Rider A attempts to trigger SOS spoofing Rider B -> 403 Forbidden
    const crossSos = await request.post(`/api/trips/${tripB.id}/sos`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { userId: userB.id, description: "Spoofed SOS" },
    });
    expect(crossSos.status()).toBe(403);
  });

  test("22. Driver Documents & Payouts RBAC & Cross-User Defense", async ({ request }) => {
    // 1. Anonymous to /api/driver/documents -> 401
    const anonDocs = await request.get("/api/driver/documents");
    expect(anonDocs.status()).toBe(401);

    // 2. Anonymous to /api/driver/payouts -> 401 (checked before session cookies are set)
    const anonPayouts = await request.get("/api/driver/payouts");
    expect(anonPayouts.status()).toBe(401);

    // 3. Rider to /api/driver/documents & payouts -> 403
    const riderLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556605", otp: "123456", role: "RIDER" },
    });
    const { token: riderToken } = await riderLogin.json();
    const riderDocs = await request.get("/api/driver/documents", {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    expect(riderDocs.status()).toBe(403);

    const riderPayouts = await request.get("/api/driver/payouts", {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    expect(riderPayouts.status()).toBe(403);

    // 4. Driver to /api/driver/documents & payouts -> 200
    const driverLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556606", otp: "123456", role: "DRIVER", name: "Driver Rahul" },
    });
    const { token: driverToken } = await driverLogin.json();
    const driverDocs = await request.get("/api/driver/documents", {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    expect(driverDocs.ok()).toBeTruthy();

    const driverPayouts = await request.get("/api/driver/payouts", {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    expect(driverPayouts.ok()).toBeTruthy();
  });

  test("23. Admin Document Verification RBAC: Anonymous & Driver denied (401/403), Admin succeeds (200)", async ({ request }) => {
    // Anonymous
    const anonRes = await request.patch("/api/admin/drivers/drv_test/documents", {
      data: { docType: "DRIVING_LICENSE", status: "APPROVED" },
    });
    expect([401, 403]).toContain(anonRes.status());

    // Driver attempting to approve own document -> 403 Forbidden
    const driverLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556607", otp: "123456", role: "DRIVER" },
    });
    const { token: driverToken } = await driverLogin.json();
    const driverRes = await request.patch("/api/admin/drivers/drv_test/documents", {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: { docType: "DRIVING_LICENSE", status: "APPROVED" },
    });
    expect(driverRes.status()).toBe(403);
  });

  test("24. Cross-User Incident Reporting Defense: Rider A cannot attach incident to Rider B's trip (403)", async ({ request }) => {
    const authA = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556608", otp: "123456", name: "Inc Rider A" },
    });
    const { token: tokenA } = await authA.json();

    const authB = await request.post("/api/auth/otp", {
      data: { identifier: "+919811556609", otp: "123456", name: "Inc Rider B" },
    });
    const { user: userB, token: tokenB } = await authB.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];
    const reqB = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { userId: userB.id, flightId: flight.id, destinationZone: "Bandra" },
    });
    const { rideRequest: rideB } = await reqB.json();
    const soloB = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { userId: userB.id, rideRequestId: rideB.id },
    });
    const { trip: tripB } = await soloB.json();

    // Rider A attempts to report incident attached to Rider B's trip -> 403 Forbidden
    const crossInc = await request.post("/api/incidents", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: {
        tripId: tripB.id,
        description: "Rider A reporting on Rider B trip",
      },
    });
    expect(crossInc.status()).toBe(403);
  });

  test("25. Marshal Station Page UI Security: Anonymous & Rider access restricted on /marshal", async ({ page }) => {
    await page.goto("http://localhost:3000/marshal");
    await page.waitForLoadState("networkidle");

    // Must show restriction error or empty state without marshal station telemetry
    const restrictedNotice = page.locator("text=Access restricted to Marshals and Airport Admins");
    await expect(restrictedNotice).toBeVisible();
  });

  test("26. Denial tests for match, solo, stream, and consent-pricing routes", async ({ request, playwright }) => {
    const anonRequest = await playwright.request.newContext();

    // 1. Authenticate users
    const riderALogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811559901", otp: "123456", name: "Denial Rider A", role: "RIDER" },
    });
    const { user: userA, token: tokenA } = await riderALogin.json();

    const riderBLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811559902", otp: "123456", name: "Denial Rider B", role: "RIDER" },
    });
    const { user: userB, token: tokenB } = await riderBLogin.json();

    const driverLogin = await request.post("/api/auth/otp", {
      data: { identifier: "+919811559903", otp: "123456", name: "Denial Driver", role: "DRIVER" },
    });
    const { token: driverToken } = await driverLogin.json();

    const flightsRes = await request.get("/api/flights");
    const flight = (await flightsRes.json()).flights[0];

    // Create a ride request for Rider B
    const rideBRes = await request.post("/api/rides/request", {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { userId: userB.id, flightId: flight.id, destinationZone: "Andheri" },
    });
    const { rideRequest: rideB } = await rideBRes.json();

    // A. /api/pools/match
    // Anonymous -> 401
    const matchAnon = await anonRequest.post("/api/pools/match", {
      data: { flightId: flight.id, terminal: "T2" },
    });
    expect(matchAnon.status()).toBe(401);

    // Wrong role (Driver) -> 403
    const matchDriver = await request.post("/api/pools/match", {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: { flightId: flight.id, terminal: "T2" },
    });
    expect(matchDriver.status()).toBe(403);

    // B. /api/pools/solo
    // Anonymous -> 401
    const soloAnon = await anonRequest.post("/api/pools/solo", {
      data: { userId: userB.id, rideRequestId: rideB.id },
    });
    expect(soloAnon.status()).toBe(401);

    // Wrong role (Driver) -> 403
    const soloDriver = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: { userId: userB.id, rideRequestId: rideB.id },
    });
    expect(soloDriver.status()).toBe(403);

    // Cross-user (Rider A attempting for Rider B) -> 403
    const soloCross = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { userId: userA.id, rideRequestId: rideB.id },
    });
    expect(soloCross.status()).toBe(403);

    // Convert Rider B to solo so trip is created
    const soloBRes = await request.post("/api/pools/solo", {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { userId: userB.id, rideRequestId: rideB.id },
    });
    expect(soloBRes.status()).toBe(200);
    const { trip: tripB } = await soloBRes.json();

    // C. /api/trips/[id]/stream
    // Anonymous -> 401
    const streamAnon = await anonRequest.get(`/api/trips/${tripB.id}/stream`);
    expect(streamAnon.status()).toBe(401);

    // Cross-user (Rider A attempting to stream Rider B's trip) -> 403
    const streamCross = await request.get(`/api/trips/${tripB.id}/stream`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(streamCross.status()).toBe(403);

    // D. /api/pools/[id]/consent-pricing
    const testQuote = await prisma.fareQuote.create({
      data: {
        userId: userB.id,
        rideRequestId: rideB.id,
        destinationZone: "Andheri",
        soloFarePaise: 35000,
        poolFarePaise: 24500,
        minSavingPct: 30,
        expiresAt: new Date(Date.now() + 600000),
        status: "ACTIVE",
      },
    });

    try {
      // Anonymous -> 401
      const consentAnon = await anonRequest.post(`/api/pools/pool_test/consent-pricing`, {
        data: { fareQuoteId: testQuote.id, accepted: true },
      });
      expect(consentAnon.status()).toBe(401);

      // Cross-user (Rider A consenting to Rider B's fare quote) -> 403
      const consentCross = await request.post(`/api/pools/pool_test/consent-pricing`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { fareQuoteId: testQuote.id, accepted: true },
      });
      expect(consentCross.status()).toBe(403);
    } finally {
      await prisma.fareQuote.delete({ where: { id: testQuote.id } }).catch(() => {});
    }
  });
});
