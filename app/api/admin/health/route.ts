import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ["ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  const startTime = Date.now();
  const missingColumns: Array<{ model: string; column: string; error: string }> = [];
  let totalColumnsChecked = 0;

  try {
    const models = Prisma.dmmf.datamodel.models;

    for (const model of models) {
      const delegateName = (model.name.charAt(0).toLowerCase() + model.name.slice(1));
      const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as {
        findFirst?: (args: { select: Record<string, boolean> }) => Promise<unknown>;
      } | undefined;

      if (!delegate || typeof delegate.findFirst !== "function") {
        continue;
      }

      const scalarFields = model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
      const selectObj: Record<string, boolean> = {};
      for (const field of scalarFields) {
        selectObj[field.name] = true;
      }
      totalColumnsChecked += scalarFields.length;

      try {
        await delegate.findFirst({ select: selectObj });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        missingColumns.push({
          model: model.name,
          column: "unknown",
          error: errorMsg,
        });
      }
    }

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          status: "drift_detected",
          database: "schema_mismatch",
          errors: missingColumns,
          totalColumnsChecked,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      contract: "valid",
      modelsChecked: models.length,
      totalColumnsChecked,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (outerErr: unknown) {
    const message = outerErr instanceof Error ? outerErr.message : "Contract health check failure";
    return NextResponse.json(
      {
        status: "error",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
