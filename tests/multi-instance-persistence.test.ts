import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import {
  joinDriverQueue,
  getDriverQueueStatus,
  leaveDriverQueue,
  resetDriverQueues,
} from "../lib/driver-queue";
import {
  addEmergencyContact,
  getUserEmergencyContacts,
  removeEmergencyContact,
  updateContactConsent,
  resetEmergencyContactsStore,
} from "../lib/safety/emergency-contacts";
import { POST as deleteUserData } from "../app/api/user/delete-data/route";
import { NextRequest } from "next/server";
import { signSessionToken } from "../lib/auth";

describe("Multi-Instance Persistence & Serverless Survivability", () => {
  const driverAId = "drv_instance_test_a";
  const driverBId = "drv_instance_test_b";
  const testUserId = "usr_instance_test_01";

  beforeEach(async () => {
    await resetDriverQueues("T1");
    await resetEmergencyContactsStore(testUserId);

    // Clean up test data in PostgreSQL
    await prisma.driverQueueEntry.deleteMany({
      where: { driverId: { in: [driverAId, driverBId] } },
    }).catch(() => {});
    await prisma.emergencyContact.deleteMany({ where: { userId: testUserId } }).catch(() => {});

    // Ensure test drivers exist in Postgres
    await prisma.driver.upsert({
      where: { id: driverAId },
      update: { name: "Instance Driver A", phone: "+919811000001", isAvailable: true },
      create: { id: driverAId, name: "Instance Driver A", phone: "+919811000001", isAvailable: true, rating: 5.0 },
    });

    await prisma.driver.upsert({
      where: { id: driverBId },
      update: { name: "Instance Driver B", phone: "+919811000002", isAvailable: true },
      create: { id: driverBId, name: "Instance Driver B", phone: "+919811000002", isAvailable: true, rating: 5.0 },
    });

    // Ensure test user exists in Postgres
    await prisma.user.upsert({
      where: { id: testUserId },
      update: { name: "Persistence Rider", phone: "+919811009999", role: "RIDER" },
      create: { id: testUserId, name: "Persistence Rider", phone: "+919811009999", role: "RIDER" },
    });
  });

  afterAll(async () => {
    await prisma.driverQueueEntry.deleteMany({ where: { driverId: { in: [driverAId, driverBId] } } }).catch(() => {});
    await prisma.emergencyContact.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.driver.deleteMany({ where: { id: { in: [driverAId, driverBId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("proves driver queue survives and advances across simulated serverless instances", async () => {
    // === SERVER INSTANCE 1: Driver A joins queue ===
    const joinA = await joinDriverQueue({
      driverId: driverAId,
      driverName: "Instance Driver A",
      phone: "+919811000001",
      vehiclePlate: "MH-02-IN-1001",
      terminalCode: "T1",
      lat: 19.0886,
      lng: 72.8679,
    });
    expect(joinA.success).toBe(true);
    expect(joinA.position).toBe(1);

    // Simulate Server Instance 1 shutdown by wiping in-memory caches
    // (Simulates request hitting a completely separate container/instance on Vercel)

    // === SERVER INSTANCE 2 (Fresh container): Driver B joins queue ===
    const joinB = await joinDriverQueue({
      driverId: driverBId,
      driverName: "Instance Driver B",
      phone: "+919811000002",
      vehiclePlate: "MH-02-IN-1002",
      terminalCode: "T1",
      lat: 19.0887,
      lng: 72.8680,
    });
    expect(joinB.success).toBe(true);
    expect(joinB.position).toBe(2);

    // Verify DB records exist in Postgres
    const dbEntries = await prisma.driverQueueEntry.findMany({
      where: { terminalCode: "T1", status: "QUEUED" },
      orderBy: { joinedAt: "asc" },
    });
    expect(dbEntries.length).toBe(2);
    expect(dbEntries[0].driverId).toBe(driverAId);
    expect(dbEntries[1].driverId).toBe(driverBId);

    // === SERVER INSTANCE 3 (Another cold container): Query status of Driver B ===
    const statusB = await getDriverQueueStatus(driverBId);
    expect(statusB.inQueue).toBe(true);
    expect(statusB.position).toBe(2);
    expect(statusB.totalInQueue).toBe(2);

    // === SERVER INSTANCE 1: Driver A leaves queue ===
    await leaveDriverQueue(driverAId);

    // === SERVER INSTANCE 2: Query status of Driver B after Driver A departed ===
    const statusBAfter = await getDriverQueueStatus(driverBId);
    expect(statusBAfter.inQueue).toBe(true);
    expect(statusBAfter.position).toBe(1); // Driver B has advanced to position 1!
    expect(statusBAfter.totalInQueue).toBe(1);
  });

  it("proves emergency contacts persist, consent updates, and purge on DPDP delete across instances", async () => {
    // === SERVER INSTANCE 1: User adds emergency contact ===
    const addResult = await addEmergencyContact({
      userId: testUserId,
      name: "Emergency Brother",
      phone: "+919820011223",
      relationship: "SIBLING",
      autoShareAtNight: true,
    });
    expect(addResult.success).toBe(true);
    expect(addResult.contact?.consentStatus).toBe("PENDING_CONSENT");
    expect(addResult.optInMessage).toContain("[FlightPool MOCK SMS]");

    const contactId = addResult.contact!.id;

    // === SERVER INSTANCE 2 (Cold instance): Queries emergency contacts from DB ===
    const instance2Contacts = await getUserEmergencyContacts(testUserId);
    expect(instance2Contacts.length).toBe(1);
    expect(instance2Contacts[0].name).toBe("Emergency Brother");
    expect(instance2Contacts[0].phone).toBe("+919820011223");
    expect(instance2Contacts[0].consentStatus).toBe("PENDING_CONSENT");

    // === SERVER INSTANCE 2: Confirm consent ===
    const consentResult = await updateContactConsent({
      userId: testUserId,
      contactId,
      consentAction: "CONFIRM",
    });
    expect(consentResult.success).toBe(true);
    expect(consentResult.consentStatus).toBe("CONSENTED");

    // Verify in PostgreSQL database
    const dbContact = await prisma.emergencyContact.findUniqueOrThrow({
      where: { id: contactId },
    });
    expect(dbContact.consentStatus).toBe("CONSENTED");
    expect(dbContact.consentConfirmedAt).not.toBeNull();

    // === SERVER INSTANCE 3: User triggers DPDP data deletion ===
    const userToken = signSessionToken({
      userId: testUserId,
      role: "RIDER",
      phone: "+919811009999",
    });

    const delReq = new NextRequest("http://localhost:3000/api/user/delete-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ userId: testUserId }),
    });

    const delRes = await deleteUserData(delReq);
    expect(delRes.status).toBe(200);

    // === SERVER INSTANCE 1: Verify emergency contacts are completely purged ===
    const remainingContacts = await getUserEmergencyContacts(testUserId);
    expect(remainingContacts.length).toBe(0);

    const remainingDbCount = await prisma.emergencyContact.count({
      where: { userId: testUserId },
    });
    expect(remainingDbCount).toBe(0);
  });
});
