import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const shareToken = url.searchParams.get("token");

  // Validate authorization: either logged-in participant/admin or valid share-token
  const session = getSessionFromRequest(req);
  let isAuthorized = false;

  if (session) {
    if (session.role === "ADMIN" || session.role === "MARSHAL") {
      isAuthorized = true;
    } else {
      const trip = await prisma.trip.findUnique({
        where: { id },
        include: {
          driver: true,
          pool: { include: { members: true } },
        },
      });
      if (trip) {
        const isRider = trip.pool.members.some((m) => m.userId === session.userId);
        const isDriver = trip.driverId === session.userId || trip.driver.phone === session.phone;
        if (isRider || isDriver) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized && shareToken) {
    const validToken = await prisma.shareTripToken.findFirst({
      where: {
        tripId: id,
        token: shareToken,
        expiresAt: { gt: new Date() },
      },
    });
    if (validToken) isAuthorized = true;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized access to live stream" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let counter = 0;
      const maxTicks = 8; // ~24 seconds total (safely under Vercel's 30s limit)

      const sendUpdate = async () => {
        try {
          const trip = await prisma.trip.findUnique({
            where: { id },
            include: {
              driver: {
                select: {
                  id: true,
                  name: true,
                  rating: true,
                  currentLat: true,
                  currentLng: true,
                  phone: true,
                },
              },
              vehicle: {
                select: {
                  make: true,
                  model: true,
                  licensePlate: true,
                  color: true,
                },
              },
              pool: {
                select: {
                  status: true,
                  terminal: true,
                  destinationCluster: true,
                  version: true,
                },
              },
            },
          });

          if (!trip) {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "Trip not found" })}\n\n`)
            );
            controller.close();
            return false;
          }

          const payload = {
            tripId: trip.id,
            status: trip.status,
            poolStatus: trip.pool.status,
            terminal: trip.pool.terminal,
            cluster: trip.pool.destinationCluster,
            driver: {
              name: trip.driver.name,
              rating: trip.driver.rating,
              lat: trip.driver.currentLat,
              lng: trip.driver.currentLng,
            },
            vehicle: trip.vehicle,
            timestamp: new Date().toISOString(),
          };

          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(payload)}\n\n`));
          return true;
        } catch {
          return false;
        }
      };

      // Send initial snapshot immediately
      await sendUpdate();

      const interval = setInterval(async () => {
        counter++;
        if (req.signal.aborted || counter >= maxTicks) {
          clearInterval(interval);
          try {
            controller.enqueue(encoder.encode(`event: ping\ndata: keepalive\n\n`));
            controller.close();
          } catch {
            // Stream already closed
          }
          return;
        }

        await sendUpdate();
      }, 3000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
