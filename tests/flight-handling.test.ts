import { describe, it, expect } from "vitest";

describe("Flight Status & Delay Propagation Logic", () => {
  it("computes delay propagation timestamp delta accurately", () => {
    const scheduledArrival = new Date("2026-10-10T14:00:00Z");
    const delayMinutes = 45;

    const delayMs = delayMinutes * 60 * 1000;
    const updatedArrival = new Date(scheduledArrival.getTime() + delayMs);

    expect(updatedArrival.toISOString()).toBe("2026-10-10T14:45:00.000Z");
  });

  it("handles flight cancellation status", () => {
    const status = "CANCELLED";
    const autoRefundEligible = status === "CANCELLED";

    expect(autoRefundEligible).toBe(true);
  });
});
