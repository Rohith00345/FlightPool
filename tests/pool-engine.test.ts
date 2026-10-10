import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  OptimisticLockError,
  CapacityExceededError,
} from "../lib/pool-engine";

describe("Pool Engine & Optimistic Locking", () => {
  it("validates permissible pool state transitions", () => {
    // FORMING can transition to CONFIRMED, CANCELLED, EXPIRED
    expect(isValidTransition("FORMING", "CONFIRMED")).toBe(true);
    expect(isValidTransition("FORMING", "CANCELLED")).toBe(true);
    expect(isValidTransition("FORMING", "EXPIRED")).toBe(true);

    // CONFIRMED can transition to DISPATCHED or CANCELLED
    expect(isValidTransition("CONFIRMED", "DISPATCHED")).toBe(true);
    expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true);

    // DISPATCHED can transition to COMPLETED or CANCELLED
    expect(isValidTransition("DISPATCHED", "COMPLETED")).toBe(true);
    expect(isValidTransition("DISPATCHED", "CANCELLED")).toBe(true);

    // Terminal states cannot transition
    expect(isValidTransition("COMPLETED", "FORMING")).toBe(false);
    expect(isValidTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(isValidTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(isValidTransition("EXPIRED", "FORMING")).toBe(false);

    // Illegal skipping transitions
    expect(isValidTransition("FORMING", "COMPLETED")).toBe(false);
    expect(isValidTransition("FORMING", "DISPATCHED")).toBe(false);
  });

  it("constructs and throws OptimisticLockError with relevant context", () => {
    const error = new OptimisticLockError("pool_123", 4);
    expect(error.name).toBe("OptimisticLockError");
    expect(error.poolId).toBe("pool_123");
    expect(error.expectedVersion).toBe(4);
    expect(error.message).toContain("Optimistic lock collision");
  });

  it("constructs CapacityExceededError when vehicle limits are exceeded", () => {
    const error = new CapacityExceededError("Vehicle is full");
    expect(error.name).toBe("CapacityExceededError");
    expect(error.message).toBe("Vehicle is full");
  });
});
