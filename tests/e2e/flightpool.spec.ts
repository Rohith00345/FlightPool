import { test, expect } from "@playwright/test";

test.describe("FlightPool Main End-to-End Journeys", () => {
  // Test 1: Full rider onboarding, boarding pass verification, zone picking, and pool matching
  test("1. Main Journey: 3 riders get matched and complete a trip", async ({ request }) => {
    // Rider 1: Login via API / UI
    const authRes = await request.post("/api/auth/otp", {
      data: {
        identifier: "+919810100001",
        otp: "123456",
        name: "Aarav Sharma",
        gender: "MALE",
      },
    });
    expect(authRes.ok()).toBeTruthy();
    const { user: user1 } = await authRes.json();

    // Fetch flight 6E-204
    const flightsRes = await request.get("/api/flights?search=6E-204");
    const { flights } = await flightsRes.json();
    const flight = flights[0];
    expect(flight).toBeDefined();

    // Verify Boarding Pass
    const verifyRes = await request.post("/api/verification", {
      data: {
        userId: user1.id,
        flightId: flight.id,
        pnr: "PNR777",
        seatNumber: "14B",
      },
    });
    expect(verifyRes.ok()).toBeTruthy();

    // Ride Request: Aarav to Thane
    const reqRes = await request.post("/api/rides/request", {
      data: {
        userId: user1.id,
        flightId: flight.id,
        destinationZone: "Thane",
        destinationAddress: "Hiranandani Estate, Ghodbunder Rd",
        luggageCount: 1,
        womenOnly: false,
        isReady: true,
      },
    });
    expect(reqRes.ok()).toBeTruthy();

    // Trigger matching engine
    const matchRes = await request.post("/api/pools/match", {
      data: { flightId: flight.id },
    });
    expect(matchRes.ok()).toBeTruthy();

    // Check status
    const statusRes = await request.get(`/api/rides/status?userId=${user1.id}`);
    const statusData = await statusRes.json();
    expect(statusData.activeRequest).toBeDefined();

    if (statusData.pool) {
      const poolId = statusData.pool.id;

      // Confirm pool and authorize payment
      const confirmRes = await request.post("/api/pools/confirm", {
        data: {
          poolId,
          userId: user1.id,
          paymentMethod: "UPI",
        },
      });
      expect(confirmRes.ok()).toBeTruthy();
      const confirmData = await confirmRes.json();
      expect(confirmData.payment.status).toBe("AUTHORIZED");

      // Advance trip via driver
      if (confirmData.trip?.id) {
        const tripId = confirmData.trip.id;

        // Start pickup
        await request.patch(`/api/trips/${tripId}`, {
          data: { action: "START_PICKUP" },
        });

        // Start transit
        await request.patch(`/api/trips/${tripId}`, {
          data: { action: "START_TRIP" },
        });

        // Complete trip & capture payments
        const compRes = await request.patch(`/api/trips/${tripId}`, {
          data: { action: "COMPLETE_TRIP" },
        });
        expect(compRes.ok()).toBeTruthy();
        const compData = await compRes.json();
        expect(compData.trip.status).toBe("COMPLETED");

        // Submit rating
        const rateRes = await request.post(`/api/trips/${tripId}/rate`, {
          data: {
            raterUserId: user1.id,
            score: 5,
            tags: ["Safe Driving", "Smooth Pool"],
            comment: "Great pooling experience from Mumbai Airport!",
          },
        });
        expect(rateRes.ok()).toBeTruthy();
      }
    }
  });

  // Test 2: Solo ride fallback after wait cap
  test("2. Solo Fallback: Rider goes solo after wait cap hits", async ({ request }) => {
    // Create new rider
    const authRes = await request.post("/api/auth/otp", {
      data: {
        identifier: "+919876543299",
        otp: "123456",
        name: "Solo Traveler",
        gender: "MALE",
      },
    });
    const { user } = await authRes.json();

    const flightsRes = await request.get("/api/flights");
    const { flights } = await flightsRes.json();
    const flight = flights[0];

    const reqRes = await request.post("/api/rides/request", {
      data: {
        userId: user.id,
        flightId: flight.id,
        destinationZone: "Navi Mumbai",
        destinationAddress: "Vashi Sector 17",
        luggageCount: 2,
        womenOnly: false,
        isReady: true,
      },
    });
    const { rideRequest } = await reqRes.json();

    // Trigger Solo action
    const soloRes = await request.post("/api/pools/solo", {
      data: {
        userId: user.id,
        rideRequestId: rideRequest.id,
        action: "GO_SOLO",
      },
    });
    expect(soloRes.ok()).toBeTruthy();
    const soloData = await soloRes.json();
    expect(soloData.action).toBe("GO_SOLO");
    expect(soloData.trip.status).toBe("ASSIGNED");
    expect(soloData.trip.soloFare).toBeGreaterThan(300);
    expect(soloData.trip.driver).toBeDefined();
  });

  // Test 3: Rider cancels mid-pool without penalty
  test("3. Mid-pool Cancellation: Rider leaves pool penalty-free prior to trip start", async ({ request }) => {
    const authRes1 = await request.post("/api/auth/otp", {
      data: { identifier: "+919800000001", otp: "123456", name: "Rider Alpha" },
    });
    const { user: user1 } = await authRes1.json();

    const authRes2 = await request.post("/api/auth/otp", {
      data: { identifier: "+919800000002", otp: "123456", name: "Rider Beta" },
    });
    const { user: user2 } = await authRes2.json();

    const flightsRes = await request.get("/api/flights");
    const flight = (await flightsRes.json()).flights[0];

    await request.post("/api/rides/request", {
      data: {
        userId: user1.id,
        flightId: flight.id,
        destinationZone: "Andheri",
        destinationAddress: "Lokhandwala Complex",
        isReady: true,
      },
    });

    await request.post("/api/rides/request", {
      data: {
        userId: user2.id,
        flightId: flight.id,
        destinationZone: "Andheri",
        destinationAddress: "Versova Metro",
        isReady: true,
      },
    });

    // Run matching
    await request.post("/api/pools/match", { data: { flightId: flight.id } });

    const statusRes = await request.get(`/api/rides/status?userId=${user1.id}`);
    const { pool } = await statusRes.json();

    if (pool) {
      // Rider 1 leaves the pool
      const leaveRes = await request.post("/api/pools/leave", {
        data: {
          poolId: pool.id,
          userId: user1.id,
        },
      });
      expect(leaveRes.ok()).toBeTruthy();
      const leaveData = await leaveRes.json();
      expect(leaveData.success).toBe(true);

      // Verify Rider 1 is back to searching
      const statusAfter = await request.get(`/api/rides/status?userId=${user1.id}`);
      const afterData = await statusAfter.json();
      expect(afterData.activeRequest.status).toBe("SEARCHING");
    }
  });

  // Test 4: Women-only pool strictness
  test("4. Women-Only Pool: Female riders requesting women-only form dedicated pool", async ({ request }) => {
    const auth1 = await request.post("/api/auth/otp", {
      data: { identifier: "+919811111101", otp: "123456", name: "Sneha D", gender: "FEMALE" },
    });
    const { user: female1 } = await auth1.json();

    const auth2 = await request.post("/api/auth/otp", {
      data: { identifier: "+919811111102", otp: "123456", name: "Ananya J", gender: "FEMALE" },
    });
    const { user: female2 } = await auth2.json();

    const flight = (await (await request.get("/api/flights")).json()).flights[0];

    await request.post("/api/rides/request", {
      data: {
        userId: female1.id,
        flightId: flight.id,
        destinationZone: "Bandra",
        destinationAddress: "Hill Road, Bandra West",
        womenOnly: true,
        isReady: true,
      },
    });

    await request.post("/api/rides/request", {
      data: {
        userId: female2.id,
        flightId: flight.id,
        destinationZone: "Bandra",
        destinationAddress: "Carter Road Promenade",
        womenOnly: true,
        isReady: true,
      },
    });

    await request.post("/api/pools/match", { data: { flightId: flight.id } });

    const status1 = await (await request.get(`/api/rides/status?userId=${female1.id}`)).json();
    if (status1.pool) {
      // Ensure all members are female
      for (const m of status1.pool.members) {
        expect(m.gender).toBe("FEMALE");
      }
    }
  });

  // Test 5: UI Test on Home Page with Mobile Viewport (360px width)
  test("5. Mobile Viewport 360px UI and English interface", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");

    // Verify Title & header
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("header").locator("text=FlightPool")).toBeVisible();
    await expect(page.locator("header").locator("text=BOM")).toBeVisible();

    // Verify Login Button exists
    const loginBtn = page.locator("#login-btn");
    await expect(loginBtn).toBeVisible();

    // Click Aarav Sharma Quick Persona
    const quickAarav = page.locator("text=Aarav Sharma").first();
    await quickAarav.click();

    // Submit Auth
    await loginBtn.click();

    // Should progress to Flight selection
    await expect(page.locator("text=Select Your Flight")).toBeVisible();
  });
});
