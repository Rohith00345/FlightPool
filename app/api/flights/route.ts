import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const terminal = searchParams.get("terminal");

    const flights = await prisma.flight.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { flightNumber: { contains: search } },
                  { airline: { contains: search } },
                  { origin: { contains: search } },
                ],
              }
            : {},
          terminal ? { terminal } : {},
        ],
      },
      include: {
        _count: {
          select: {
            rideRequests: true,
          },
        },
      },
      orderBy: {
        arrivalTime: "desc",
      },
      take: 30,
    });

    return NextResponse.json({
      flights: flights.map((f) => ({
        id: f.id,
        flightNumber: f.flightNumber,
        airline: f.airline,
        origin: f.origin,
        destination: f.destination,
        terminal: f.terminal,
        arrivalTime: f.arrivalTime,
        status: f.status,
        activeRequestsCount: f._count.rideRequests,
      })),
    });
  } catch (error: unknown) {
    console.error("Flights GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flights", details: String(error) },
      { status: 500 }
    );
  }
}
