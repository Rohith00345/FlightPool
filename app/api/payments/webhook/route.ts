import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/provider";
import { recordFarePaymentLedger, recordRefundLedger } from "@/lib/ledger";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-razorpay-signature");
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-razorpay-signature header" },
        { status: 400 }
      );
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const refundEntity = payload.payload?.refund?.entity;

    if (!event) {
      return NextResponse.json({ error: "Missing event in payload" }, { status: 400 });
    }

    // Process event types idempotently
    if (event === "payment.captured" && paymentEntity) {
      const transactionRef = paymentEntity.id;
      const amountPaise = paymentEntity.amount; // Razorpay sends amount in paise

      const existingPayment = await prisma.payment.findFirst({
        where: { transactionRef },
        include: { trip: true },
      });

      if (existingPayment) {
        if (existingPayment.status !== "CAPTURED") {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: { status: "CAPTURED" },
          });

          // Post to double-entry ledger if linked to a trip with a driver
          if (existingPayment.trip && existingPayment.trip.driverId) {
            await recordFarePaymentLedger({
              paymentId: existingPayment.id,
              tripId: existingPayment.trip.id,
              userId: existingPayment.userId,
              driverId: existingPayment.trip.driverId,
              totalFarePaise: amountPaise,
            });
          }
        }
      }
    } else if (event === "payment.failed" && paymentEntity) {
      const transactionRef = paymentEntity.id;
      const existingPayment = await prisma.payment.findFirst({
        where: { transactionRef },
      });

      if (existingPayment && existingPayment.status !== "FAILED") {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: { status: "FAILED" },
        });
      }
    } else if (event === "refund.processed" && refundEntity) {
      const paymentRef = refundEntity.payment_id;
      const refundRef = refundEntity.id;
      const refundAmountPaise = refundEntity.amount;

      const existingPayment = await prisma.payment.findFirst({
        where: { transactionRef: paymentRef },
        include: { trip: true },
      });

      if (existingPayment) {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: { status: "REFUNDED" },
        });

        if (existingPayment.trip && existingPayment.trip.driverId) {
          await recordRefundLedger({
            paymentId: existingPayment.id,
            refundId: refundRef,
            driverId: existingPayment.trip.driverId,
            refundPaise: refundAmountPaise,
          });
        }
      }
    }

    return NextResponse.json({ received: true, event });
  } catch (error: unknown) {
    console.error("Payment webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error", details: String(error) },
      { status: 500 }
    );
  }
}
