import { describe, it, expect, beforeEach } from "vitest";
import {
  validateEmergencyPhone,
  isNightRideWindow,
  addEmergencyContact,
  getUserEmergencyContacts,
  removeEmergencyContact,
  auditNightRideSafety,
  resetEmergencyContactsStore,
} from "../lib/safety/emergency-contacts";
import { signSessionToken } from "../lib/auth";
import { NextRequest } from "next/server";
import { GET as getContacts, POST as postContact, DELETE as deleteContact } from "../app/api/user/emergency-contacts/route";
import { POST as safetyCheck } from "../app/api/rides/safety-check/route";

describe("Emergency Trusted Contacts & Night Ride Safety Guard", () => {
  beforeEach(() => {
    resetEmergencyContactsStore();
  });

  describe("Unit: Phone Validation & Input Rules", () => {
    it("validates valid Indian E.164 mobile numbers (+91 followed by 10 digits starting with 6-9)", () => {
      expect(validateEmergencyPhone("+919876543210")).toBe(true);
      expect(validateEmergencyPhone("+918123456789")).toBe(true);
      expect(validateEmergencyPhone("+917000000000")).toBe(true);
      expect(validateEmergencyPhone("+916234567890")).toBe(true);
    });

    it("rejects invalid phone numbers", () => {
      expect(validateEmergencyPhone("9876543210")).toBe(false); // Missing +91
      expect(validateEmergencyPhone("+915123456789")).toBe(false); // Starts with 5
      expect(validateEmergencyPhone("+91987654321")).toBe(false); // 9 digits
      expect(validateEmergencyPhone("+14155552671")).toBe(false); // US number
      expect(validateEmergencyPhone("")).toBe(false);
    });
  });

  describe("Unit: Contact Store & Invariants", () => {
    const userId = "usr_safety_test";

    it("adds trusted contact successfully", () => {
      const res = addEmergencyContact({
        userId,
        name: "Pooja Sharma",
        phone: "+919876543210",
        relationship: "SPOUSE",
        autoShareAtNight: true,
      });

      expect(res.success).toBe(true);
      expect(res.contact?.name).toBe("Pooja Sharma");
      expect(res.contact?.relationship).toBe("SPOUSE");
      expect(res.contact?.autoShareAtNight).toBe(true);

      const contacts = getUserEmergencyContacts(userId);
      expect(contacts.length).toBe(1);
    });

    it("enforces maximum of 3 emergency contacts per user", () => {
      addEmergencyContact({ userId, name: "Contact 1", phone: "+919876543211", relationship: "PARENT" });
      addEmergencyContact({ userId, name: "Contact 2", phone: "+919876543212", relationship: "SIBLING" });
      addEmergencyContact({ userId, name: "Contact 3", phone: "+919876543213", relationship: "FRIEND" });

      const overflow = addEmergencyContact({
        userId,
        name: "Contact 4",
        phone: "+919876543214",
        relationship: "COLLEAGUE",
      });

      expect(overflow.success).toBe(false);
      expect(overflow.error).toContain("Maximum of 3 emergency contacts");
      expect(getUserEmergencyContacts(userId).length).toBe(3);
    });

    it("prevents duplicate phone numbers for the same user", () => {
      addEmergencyContact({ userId, name: "First", phone: "+919876543210", relationship: "SPOUSE" });
      const duplicate = addEmergencyContact({ userId, name: "Second", phone: "+919876543210", relationship: "FRIEND" });

      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toContain("already exists");
    });

    it("allows removing contacts", () => {
      const added = addEmergencyContact({ userId, name: "To Remove", phone: "+919876543210", relationship: "OTHER" });
      expect(getUserEmergencyContacts(userId).length).toBe(1);

      const removed = removeEmergencyContact(userId, added.contact!.id);
      expect(removed.success).toBe(true);
      expect(getUserEmergencyContacts(userId).length).toBe(0);
    });
  });

  describe("Unit: Night Ride Detection & Auto-Share Dispatches", () => {
    it("correctly identifies night hours in IST (21:00 to 06:00)", () => {
      // 23:00 IST (17:30 UTC)
      const nightDate = new Date("2026-10-11T17:30:00Z");
      const checkNight = isNightRideWindow(nightDate);
      expect(checkNight.isNight).toBe(true);
      expect(checkNight.istHour).toBe(23);

      // 03:00 IST (21:30 UTC previous day)
      const earlyMorning = new Date("2026-10-10T21:30:00Z");
      const checkEarly = isNightRideWindow(earlyMorning);
      expect(checkEarly.isNight).toBe(true);
      expect(checkEarly.istHour).toBe(3);

      // 14:00 IST (08:30 UTC)
      const dayDate = new Date("2026-10-11T08:30:00Z");
      const checkDay = isNightRideWindow(dayDate);
      expect(checkDay.isNight).toBe(false);
      expect(checkDay.istHour).toBe(14);
    });

    it("dispatches auto-share tracking alerts during night rides", () => {
      const userId = "usr_night_rider";
      addEmergencyContact({
        userId,
        name: "Aarti",
        phone: "+919876543210",
        relationship: "SPOUSE",
        autoShareAtNight: true,
      });

      const nightDate = new Date("2026-10-11T17:30:00Z"); // 23:00 IST
      const audit = auditNightRideSafety({
        userId,
        riderName: "Rahul",
        originTerminal: "T2",
        corridor: "Powai",
        driverName: "Santosh",
        vehiclePlate: "MH-02-CP-4455",
        shareToken: "token_abc_123",
        currentTime: nightDate,
      });

      expect(audit.isNightWindow).toBe(true);
      expect(audit.autoShareApplicable).toBe(true);
      expect(audit.alertDispatched).toBe(true);
      expect(audit.dispatchedAlerts.length).toBe(1);
      expect(audit.dispatchedAlerts[0].recipientPhone).toBe("+919876543210");
      expect(audit.dispatchedAlerts[0].messageText).toContain("Rahul");
      expect(audit.dispatchedAlerts[0].messageText).toContain("CSMIA T2");
      expect(audit.dispatchedAlerts[0].messageText).toContain("https://flightpool.in/track/token_abc_123");
    });

    it("suppresses auto-share dispatch during daytime journeys", () => {
      const userId = "usr_day_rider";
      addEmergencyContact({
        userId,
        name: "Aarti",
        phone: "+919876543210",
        relationship: "SPOUSE",
        autoShareAtNight: true,
      });

      const dayDate = new Date("2026-10-11T08:30:00Z"); // 14:00 IST
      const audit = auditNightRideSafety({
        userId,
        riderName: "Rahul",
        originTerminal: "T2",
        corridor: "Powai",
        driverName: "Santosh",
        vehiclePlate: "MH-02-CP-4455",
        shareToken: "token_abc_123",
        currentTime: dayDate,
      });

      expect(audit.isNightWindow).toBe(false);
      expect(audit.autoShareApplicable).toBe(false);
      expect(audit.alertDispatched).toBe(false);
      expect(audit.dispatchedAlerts.length).toBe(0);
    });
  });

  describe("API: Emergency Contacts Endpoints & RBAC", () => {
    const riderToken = signSessionToken({
      userId: "usr_api_rider",
      role: "RIDER",
      name: "Sneha Rao",
      phone: "+919988771199",
    });

    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/user/emergency-contacts");
      const res = await getContacts(req);
      expect(res.status).toBe(401);
    });

    it("adds emergency contact for authenticated rider with 201", async () => {
      const req = new NextRequest("http://localhost:3000/api/user/emergency-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${riderToken}`,
        },
        body: JSON.stringify({
          name: "Mother",
          phone: "+919876543210",
          relationship: "PARENT",
          autoShareAtNight: true,
        }),
      });

      const res = await postContact(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.contact.name).toBe("Mother");
    });

    it("lists emergency contacts for authenticated rider with 200", async () => {
      addEmergencyContact({
        userId: "usr_api_rider",
        name: "Mother",
        phone: "+919876543210",
        relationship: "PARENT",
        autoShareAtNight: true,
      });

      const req = new NextRequest("http://localhost:3000/api/user/emergency-contacts", {
        headers: {
          Authorization: `Bearer ${riderToken}`,
        },
      });

      const res = await getContacts(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(1);
      expect(json.contacts[0].name).toBe("Mother");
    });

    it("deletes emergency contact with 200", async () => {
      const added = addEmergencyContact({
        userId: "usr_api_rider",
        name: "Mother",
        phone: "+919876543210",
        relationship: "PARENT",
        autoShareAtNight: true,
      });
      const contactId = added.contact!.id;

      const delReq = new NextRequest(`http://localhost:3000/api/user/emergency-contacts?contactId=${contactId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${riderToken}` },
      });
      const delRes = await deleteContact(delReq);
      expect(delRes.status).toBe(200);
    });

    it("executes night ride safety check endpoint with 200", async () => {
      const req = new NextRequest("http://localhost:3000/api/rides/safety-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${riderToken}`,
        },
        body: JSON.stringify({
          simulatedHour: 23, // 11 PM night ride
        }),
      });

      const res = await safetyCheck(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.audit.isNightWindow).toBe(true);
    });
  });
});
