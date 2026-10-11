import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyRazorpayWebhookSignature,
  verifyCashfreeWebhookSignature,
  CashfreeLiveProvider,
  getPaymentProvider,
} from "../lib/payments/provider";

describe("Payment Provider & Webhook Signature Verification", () => {
  const secret = "rzp_whsec_test_secret_key_123456789";

  it("successfully validates authentic Razorpay webhook signature", () => {
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 45000 } } },
    });

    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const result = verifyRazorpayWebhookSignature(payload, validSignature, secret);
    expect(result).toBe(true);
  });

  it("rejects tampered webhook payload with valid signature", () => {
    const originalPayload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 45000 } } },
    });
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(originalPayload)
      .digest("hex");

    const tamperedPayload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 5000 } } }, // tampered amount
    });

    const result = verifyRazorpayWebhookSignature(tamperedPayload, validSignature, secret);
    expect(result).toBe(false);
  });

  it("rejects invalid signature string", () => {
    const payload = JSON.stringify({ event: "payment.failed" });
    const forgedSignature = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    const result = verifyRazorpayWebhookSignature(payload, forgedSignature, secret);
    expect(result).toBe(false);
  });

  it("fails closed when secret or signature is missing", () => {
    const payload = JSON.stringify({ event: "ping" });
    expect(verifyRazorpayWebhookSignature(payload, "", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(payload, "sig", "")).toBe(false);
  });

  describe("Cashfree Webhook & Live Provider", () => {
    const cfSecret = "cf_sec_key_mock_987654321";
    const timestamp = "1728567890";
    const body = JSON.stringify({
      data: { order: { order_id: "order_123", order_amount: 550.0 } },
      event_time: "2026-10-10T14:30:00Z",
      type: "PAYMENT_SUCCESS_WEBHOOK",
    });

    it("successfully validates authentic Cashfree webhook signature", () => {
      const signature = crypto
        .createHmac("sha256", cfSecret)
        .update(`${timestamp}${body}`)
        .digest("base64");

      const result = verifyCashfreeWebhookSignature(timestamp, body, signature, cfSecret);
      expect(result).toBe(true);
    });

    it("rejects tampered Cashfree webhook payload", () => {
      const signature = crypto
        .createHmac("sha256", cfSecret)
        .update(`${timestamp}${body}`)
        .digest("base64");

      const tamperedBody = JSON.stringify({
        data: { order: { order_id: "order_123", order_amount: 10.0 } },
      });

      const result = verifyCashfreeWebhookSignature(timestamp, tamperedBody, signature, cfSecret);
      expect(result).toBe(false);
    });

    it("fails closed when Cashfree signature or timestamp is missing", () => {
      expect(verifyCashfreeWebhookSignature("", body, "sig", cfSecret)).toBe(false);
      expect(verifyCashfreeWebhookSignature(timestamp, body, "", cfSecret)).toBe(false);
      expect(verifyCashfreeWebhookSignature(timestamp, body, "sig", "")).toBe(false);
    });

    it("executes CashfreeLiveProvider authorize, capture, and refund lifecycle", async () => {
      const provider = new CashfreeLiveProvider("cf_app_id", "cf_secret");
      const auth = await provider.authorize({
        amount: 450,
        userId: "user_test_cf",
        idempotencyKey: "idem_cf_1",
      });

      expect(auth.status).toBe("AUTHORIZED");
      expect(auth.amount).toBe(450);
      expect(auth.id).toContain("cf_pay_");

      const cap = await provider.capture({
        paymentId: auth.id,
        amount: 450,
      });
      expect(cap.status).toBe("CAPTURED");

      const ref = await provider.refund({
        paymentId: auth.id,
        amount: 450,
      });
      expect(ref.status).toBe("REFUNDED");
    });

    it("factory resolves Cashfree provider when configured", () => {
      const originalEnv = { ...process.env };
      try {
        process.env.PAYMENT_PROVIDER = "cashfree";
        process.env.CASHFREE_APP_ID = "cf_test_app";
        process.env.CASHFREE_SECRET_KEY = "cf_test_secret";
        const provider = getPaymentProvider();
        expect(provider.name).toContain("Cashfree");
      } finally {
        process.env = originalEnv;
      }
    });
  });
});
