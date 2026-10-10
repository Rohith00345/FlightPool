import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyRazorpayWebhookSignature } from "../lib/payments/provider";

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
});
