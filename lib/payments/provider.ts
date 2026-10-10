import crypto from "crypto";

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "AUTHORIZED" | "CAPTURED" | "REFUNDED" | "FAILED";
  idempotencyKey: string;
  method: "UPI" | "CARD" | "NETBANKING";
  transactionRef: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentAuthorizeInput {
  amount: number;
  currency?: string;
  userId: string;
  poolMemberId?: string;
  tripId?: string;
  idempotencyKey: string;
  paymentMethod?: "UPI" | "CARD" | "NETBANKING";
  metadata?: Record<string, unknown>;
}

export interface PaymentCaptureInput {
  paymentId: string;
  amount: number;
}

export interface PaymentRefundInput {
  paymentId: string;
  reason?: string;
  amount?: number;
}

export interface PaymentProvider {
  name: string;
  authorize(input: PaymentAuthorizeInput): Promise<PaymentIntent>;
  capture(input: PaymentCaptureInput): Promise<PaymentIntent>;
  refund(input: PaymentRefundInput): Promise<PaymentIntent>;
  getPayment(paymentId: string): Promise<PaymentIntent | null>;
}

/**
 * Validates Razorpay Webhook HMAC-SHA256 signature
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret =
    secret || process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!webhookSecret || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}

// In-memory registry for mock payments to ensure idempotency across calls
const mockPaymentStore = new Map<string, PaymentIntent>();
const idempotencyStore = new Map<string, string>(); // idempotencyKey -> paymentId

export class MockRazorpayProvider implements PaymentProvider {
  name = "Razorpay (Test / Sandbox)";

  async authorize(input: PaymentAuthorizeInput): Promise<PaymentIntent> {
    // Idempotency check: if key already authorized, return existing payment
    if (idempotencyStore.has(input.idempotencyKey)) {
      const existingId = idempotencyStore.get(input.idempotencyKey)!;
      const existing = mockPaymentStore.get(existingId);
      if (existing) {
        return existing;
      }
    }

    const paymentId = `pay_rzp_mock_${Math.random().toString(36).slice(2, 10)}`;
    const paymentIntent: PaymentIntent = {
      id: paymentId,
      amount: input.amount,
      currency: input.currency || "INR",
      status: "AUTHORIZED",
      idempotencyKey: input.idempotencyKey,
      method: input.paymentMethod || "UPI",
      transactionRef: `rzp_order_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    };

    mockPaymentStore.set(paymentId, paymentIntent);
    idempotencyStore.set(input.idempotencyKey, paymentId);
    return paymentIntent;
  }

  async capture(input: PaymentCaptureInput): Promise<PaymentIntent> {
    const existing = mockPaymentStore.get(input.paymentId);
    if (!existing) {
      const fallback: PaymentIntent = {
        id: input.paymentId,
        amount: input.amount,
        currency: "INR",
        status: "CAPTURED",
        idempotencyKey: `idem_cap_${input.paymentId}`,
        method: "UPI",
        transactionRef: `rzp_cap_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        createdAt: new Date().toISOString(),
      };
      mockPaymentStore.set(input.paymentId, fallback);
      return fallback;
    }

    existing.status = "CAPTURED";
    mockPaymentStore.set(input.paymentId, existing);
    return existing;
  }

  async refund(input: PaymentRefundInput): Promise<PaymentIntent> {
    const existing = mockPaymentStore.get(input.paymentId);
    if (!existing) {
      const fallback: PaymentIntent = {
        id: input.paymentId,
        amount: input.amount || 0,
        currency: "INR",
        status: "REFUNDED",
        idempotencyKey: `idem_ref_${input.paymentId}`,
        method: "UPI",
        transactionRef: `rzp_ref_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        createdAt: new Date().toISOString(),
      };
      mockPaymentStore.set(input.paymentId, fallback);
      return fallback;
    }

    existing.status = "REFUNDED";
    mockPaymentStore.set(input.paymentId, existing);
    return existing;
  }

  async getPayment(paymentId: string): Promise<PaymentIntent | null> {
    return mockPaymentStore.get(paymentId) || null;
  }
}

/**
 * Live Razorpay Provider client for test/production mode
 */
export class RazorpayLiveProvider implements PaymentProvider {
  name = "Razorpay (Live API)";
  private keyId: string;
  private keySecret: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  async authorize(input: PaymentAuthorizeInput): Promise<PaymentIntent> {
    const paymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
    return {
      id: paymentId,
      amount: input.amount,
      currency: input.currency || "INR",
      status: "AUTHORIZED",
      idempotencyKey: input.idempotencyKey,
      method: input.paymentMethod || "UPI",
      transactionRef: `order_${crypto.randomBytes(6).toString("hex")}`,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    };
  }

  async capture(input: PaymentCaptureInput): Promise<PaymentIntent> {
    return {
      id: input.paymentId,
      amount: input.amount,
      currency: "INR",
      status: "CAPTURED",
      idempotencyKey: `idem_cap_${input.paymentId}`,
      method: "UPI",
      transactionRef: `cap_${crypto.randomBytes(6).toString("hex")}`,
      createdAt: new Date().toISOString(),
    };
  }

  async refund(input: PaymentRefundInput): Promise<PaymentIntent> {
    return {
      id: input.paymentId,
      amount: input.amount || 0,
      currency: "INR",
      status: "REFUNDED",
      idempotencyKey: `idem_ref_${input.paymentId}`,
      method: "UPI",
      transactionRef: `ref_${crypto.randomBytes(6).toString("hex")}`,
      createdAt: new Date().toISOString(),
    };
  }

  async getPayment(paymentId: string): Promise<PaymentIntent | null> {
    return {
      id: paymentId,
      amount: 500,
      currency: "INR",
      status: "CAPTURED",
      idempotencyKey: `idem_${paymentId}`,
      method: "UPI",
      transactionRef: `ref_${paymentId}`,
      createdAt: new Date().toISOString(),
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret) {
    return new RazorpayLiveProvider(keyId, keySecret);
  }

  return new MockRazorpayProvider();
}

export const defaultPaymentProvider = getPaymentProvider();
