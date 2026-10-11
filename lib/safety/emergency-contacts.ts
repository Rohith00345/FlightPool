/**
 * Emergency Contacts & Night Ride Safety Guard
 *
 * Implements rider safety mechanics compliant with women's safety protocols and DPDP consent.
 * Detects night arrival windows (21:00 - 06:00 IST), manages verified trusted contacts,
 * and generates automated tracking link dispatches.
 */

export type ContactRelationship =
  | "SPOUSE"
  | "PARENT"
  | "SIBLING"
  | "FRIEND"
  | "COLLEAGUE"
  | "OTHER";

export const ALLOWED_RELATIONSHIPS: ContactRelationship[] = [
  "SPOUSE",
  "PARENT",
  "SIBLING",
  "FRIEND",
  "COLLEAGUE",
  "OTHER",
];

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string; // E.164 +91XXXXXXXXXX
  relationship: ContactRelationship;
  autoShareAtNight: boolean;
  createdAt: string;
}

export interface NightRideAuditResult {
  isNightWindow: boolean;
  currentIstHour: number;
  autoShareApplicable: boolean;
  contactsEligibleCount: number;
  alertDispatched: boolean;
  dispatchedAlerts: {
    recipientPhone: string;
    recipientName: string;
    messageText: string;
    trackingUrl: string;
  }[];
}

// In-memory trusted contact store indexed by userId
const userContactsStore: Map<string, EmergencyContact[]> = new Map();

/**
 * Validates standard Indian E.164 phone numbers (+91 followed by 10 digits starting with 6-9).
 */
export function validateEmergencyPhone(phone: string): boolean {
  if (!phone) return false;
  return /^\+91[6-9]\d{9}$/.test(phone.trim());
}

/**
 * Evaluates whether a given timestamp falls into the night ride window (21:00 to 06:00 IST).
 */
export function isNightRideWindow(date: Date = new Date()): {
  isNight: boolean;
  istHour: number;
} {
  // Convert date to Asia/Kolkata timezone
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  });
  const istHour = parseInt(istFormatter.format(date), 10);
  const isNight = istHour >= 21 || istHour < 6;

  return { isNight, istHour };
}

/**
 * Retrieves emergency contacts for a given user.
 */
export function getUserEmergencyContacts(userId: string): EmergencyContact[] {
  return userContactsStore.get(userId) || [];
}

/**
 * Adds an emergency contact for a user (enforcing max 3 contacts and E.164 validation).
 */
export function addEmergencyContact(params: {
  userId: string;
  name: string;
  phone: string;
  relationship: ContactRelationship;
  autoShareAtNight?: boolean;
}): { success: boolean; contact?: EmergencyContact; error?: string } {
  const existing = getUserEmergencyContacts(params.userId);

  if (existing.length >= 3) {
    return {
      success: false,
      error: "Maximum of 3 emergency contacts reached. Please remove one before adding another.",
    };
  }

  const trimmedName = params.name?.trim();
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
    return {
      success: false,
      error: "Contact name must be between 2 and 50 characters",
    };
  }

  const cleanPhone = params.phone?.trim();
  if (!validateEmergencyPhone(cleanPhone)) {
    return {
      success: false,
      error: "Invalid phone number. Must be a valid Indian E.164 mobile number (+91XXXXXXXXXX)",
    };
  }

  if (!ALLOWED_RELATIONSHIPS.includes(params.relationship)) {
    return {
      success: false,
      error: `Invalid relationship. Allowed types: ${ALLOWED_RELATIONSHIPS.join(", ")}`,
    };
  }

  if (existing.some((c) => c.phone === cleanPhone)) {
    return {
      success: false,
      error: "A contact with this phone number already exists in your emergency list",
    };
  }

  const newContact: EmergencyContact = {
    id: `emc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: params.userId,
    name: trimmedName,
    phone: cleanPhone,
    relationship: params.relationship,
    autoShareAtNight: params.autoShareAtNight ?? true,
    createdAt: new Date().toISOString(),
  };

  userContactsStore.set(params.userId, [...existing, newContact]);

  return { success: true, contact: newContact };
}

/**
 * Removes an emergency contact.
 */
export function removeEmergencyContact(
  userId: string,
  contactId: string
): { success: boolean } {
  const existing = getUserEmergencyContacts(userId);
  const filtered = existing.filter((c) => c.id !== contactId);
  if (filtered.length === existing.length) {
    return { success: false };
  }
  userContactsStore.set(userId, filtered);
  return { success: true };
}

/**
 * Generates an emergency alert payload and tracking dispatch during night journeys.
 */
export function auditNightRideSafety(params: {
  userId: string;
  riderName: string;
  originTerminal: string;
  corridor: string;
  driverName: string;
  vehiclePlate: string;
  shareToken: string;
  currentTime?: Date;
}): NightRideAuditResult {
  const { isNight, istHour } = isNightRideWindow(params.currentTime);
  const contacts = getUserEmergencyContacts(params.userId);
  const eligibleContacts = contacts.filter((c) => c.autoShareAtNight);

  const trackingUrl = `https://flightpool.in/track/${params.shareToken}`;

  const dispatchedAlerts = isNight
    ? eligibleContacts.map((contact) => ({
        recipientPhone: contact.phone,
        recipientName: contact.name,
        messageText: `[FlightPool Safety Alert] ${params.riderName} has boarded a night airport pool from CSMIA ${params.originTerminal} to ${params.corridor}. Driver: ${params.driverName} (${params.vehiclePlate}). Live tracking: ${trackingUrl}`,
        trackingUrl,
      }))
    : [];

  return {
    isNightWindow: isNight,
    currentIstHour: istHour,
    autoShareApplicable: isNight && eligibleContacts.length > 0,
    contactsEligibleCount: eligibleContacts.length,
    alertDispatched: dispatchedAlerts.length > 0,
    dispatchedAlerts,
  };
}

/**
 * Resets emergency contact store (strictly for testing isolation).
 */
export function resetEmergencyContactsStore(): void {
  userContactsStore.clear();
}
