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
}

export interface PaymentProvider {
  name: string;
  authorize(input: PaymentAuthorizeInput): Promise<PaymentIntent>;
  capture(input: PaymentCaptureInput): Promise<PaymentIntent>;
  refund(input: PaymentRefundInput): Promise<PaymentIntent>;
  getPayment(paymentId: string): Promise<PaymentIntent | null>;
}

// In-memory registry for mock payments to ensure idempotency across calls
const mockPaymentStore = new Map<string, PaymentIntent>();
const idempotencyStore = new Map<string, string>(); // idempotencyKey -> paymentId

export class MockRazorpayProvider implements PaymentProvider {
  name = "Razorpay (Mock Sandbox)";

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
      // Fallback create mock captured record
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
        amount: 0,
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

export const defaultPaymentProvider = new MockRazorpayProvider();
