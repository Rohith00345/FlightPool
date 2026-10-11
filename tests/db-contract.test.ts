import { describe, it, expect, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

describe("Database Schema Contract & Column Integrity", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("verifies all Prisma DMMF models and scalar columns exist in the database", async () => {
    const models = Prisma.dmmf.datamodel.models;
    expect(models.length).toBeGreaterThan(0);

    const verifiedModels: string[] = [];

    for (const model of models) {
      const delegateName = model.name.charAt(0).toLowerCase() + model.name.slice(1);
      const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as {
        findFirst: (args: { select: Record<string, boolean> }) => Promise<unknown>;
      };

      expect(delegate).toBeDefined();

      // Collect all scalar and enum fields
      const scalarFields = model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
      const selectObj: Record<string, boolean> = {};
      for (const field of scalarFields) {
        selectObj[field.name] = true;
      }

      // Query database selecting all model columns with limit 1
      // If any column is missing in the database schema, Postgres will fail with error 42703
      const result = await delegate.findFirst({
        select: selectObj,
      });

      verifiedModels.push(model.name);
      // Result can be null (empty table) or an object, but query must execute without column errors
      expect(result === null || typeof result === "object").toBe(true);
    }

    expect(verifiedModels).toContain("RideRequest");
    expect(verifiedModels).toContain("Trip");
    expect(verifiedModels).toContain("Pool");
  });

  it("explicitly verifies hot-spot columns that previously caused drift", async () => {
    // 1. RideRequest.readyAt
    const rideRequest = await prisma.rideRequest.findFirst({
      select: {
        id: true,
        readyAt: true,
        autoSoloConsent: true,
      },
    });
    expect(rideRequest === null || "readyAt" in rideRequest).toBe(true);

    // 2. Trip.driverAtBayAt
    const trip = await prisma.trip.findFirst({
      select: {
        id: true,
        driverAtBayAt: true,
      },
    });
    expect(trip === null || "driverAtBayAt" in trip).toBe(true);

    // 3. Pool.confirmedAt
    const pool = await prisma.pool.findFirst({
      select: {
        id: true,
        confirmedAt: true,
      },
    });
    expect(pool === null || "confirmedAt" in pool).toBe(true);
  });
});
