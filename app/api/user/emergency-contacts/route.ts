import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import {
  getUserEmergencyContacts,
  addEmergencyContact,
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

    const contacts = getUserEmergencyContacts(session.userId);

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

    const result = addEmergencyContact({
      userId: session.userId,
      name,
      phone,
      relationship: relationship as ContactRelationship,
      autoShareAtNight,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Emergency contact successfully added",
        contact: result.contact,
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

    const result = removeEmergencyContact(session.userId, contactId);

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
