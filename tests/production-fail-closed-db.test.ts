import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../lib/prisma";
import { joinDriverQueue, getDriverQueueStatus } from "../lib/driver-queue";
import { addEmergencyContact, getUserEmergencyContacts } from "../lib/safety/emergency-contacts";

describe("Production Mode Database Fail-Closed Protection", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("strictly fails closed for driver queue when database write fails in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    // Mock prisma write to reject with DB connection error
    vi.spyOn(prisma.driverQueueEntry, "create").mockRejectedValue(
      new Error("P1001: Can't reach database server at neon.tech")
    );

    const result = await joinDriverQueue({
      driverId: "drv_prod_fail_closed",
      driverName: "Prod Test Driver",
      phone: "+919811009988",
      vehiclePlate: "MH-02-CP-9988",
      terminalCode: "T2",
      lat: 19.0968,
      lng: 72.8745,
    });

    // Must return explicit error, NOT false success via in-memory fallback
    expect(result.success).toBe(false);
    expect(result.error).toContain("Database error");

    // Queue status must reflect failure (not present in queue)
    const status = await getDriverQueueStatus("drv_prod_fail_closed");
    expect(status.inQueue).toBe(false);
  });

  it("strictly fails closed for emergency contacts when database write fails in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    // Mock prisma write to reject
    vi.spyOn(prisma.emergencyContact, "create").mockRejectedValue(
      new Error("P1001: Can't reach database server at neon.tech")
    );

    const result = await addEmergencyContact({
      userId: "usr_prod_fail_closed",
      name: "Critical Contact",
      phone: "+919876543999",
      relationship: "SPOUSE",
    });

    // Must return explicit 500 error, NOT in-memory fallback
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toContain("Database error");

    // Contacts query must not return in-memory ghost contacts
    const contacts = await getUserEmergencyContacts("usr_prod_fail_closed");
    expect(contacts.length).toBe(0);
  });
});
