import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import {
  getUserEmergencyContacts,
  addEmergencyContact,
  updateContactConsent,
  removeEmergencyContact,
  ContactRelationship,
} from "../../../../lib/safety/emergency-contacts";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/emergency-contacts
 * Returns the list of registered trusted emergency contacts for the rider.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const contacts = await getUserEmergencyContacts(session.userId);

    return NextResponse.json({
      success: true,
      userId: session.userId,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error("Fetch emergency contacts error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching emergency contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/emergency-contacts
 * Adds a new emergency contact for the authenticated rider. Max 3 contacts.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, phone, relationship, autoShareAtNight } = body;

    const result = await addEmergencyContact({
      userId: session.userId,
      name,
      phone,
      relationship: relationship as ContactRelationship,
      autoShareAtNight,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Emergency contact successfully added",
        contact: result.contact,
        optInMessage: result.optInMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add emergency contact error:", error);
    return NextResponse.json(
      { error: "Internal server error adding emergency contact" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/emergency-contacts
 * Manages consent opt-in or opt-out status for an emergency contact.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { contactId, consentAction } = body;

    if (!contactId || !["CONFIRM", "OPT_OUT"].includes(consentAction)) {
      return NextResponse.json(
        { error: "contactId and consentAction ('CONFIRM' or 'OPT_OUT') are required" },
        { status: 400 }
      );
    }

    const result = await updateContactConsent({
      userId: session.userId,
      contactId,
      consentAction,
    });

    return NextResponse.json({
      success: true,
      message: consentAction === "CONFIRM" ? "Emergency contact consent confirmed" : "Emergency contact opted out",
      consentStatus: result.consentStatus,
    });
  } catch (error) {
    console.error("Update emergency contact consent error:", error);
    return NextResponse.json(
      { error: "Internal server error updating consent" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/emergency-contacts
 * Removes an emergency contact.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let contactId = searchParams.get("contactId");

    if (!contactId) {
      const body = await req.json().catch(() => ({}));
      contactId = body.contactId;
    }

    if (!contactId) {
      return NextResponse.json(
        { error: "Contact ID is required for deletion" },
        { status: 400 }
      );
    }

    const result = await removeEmergencyContact(session.userId, contactId);

    if (!result.success) {
      return NextResponse.json(
        { error: "Contact not found or does not belong to this user" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Emergency contact removed",
      contactId,
    });
  } catch (error) {
    console.error("Delete emergency contact error:", error);
    return NextResponse.json(
      { error: "Internal server error removing emergency contact" },
      { status: 500 }
    );
  }
}
