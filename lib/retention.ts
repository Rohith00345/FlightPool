import { prisma } from "@/lib/prisma";

export async function runRetentionJob() {
  console.log(`\n======================================================`);
  console.log(`🧹 FLIGHTPOOL DATA RETENTION & COMPLIANCE JOB`);
  console.log(`   Execution Time: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // 1. Purge expired OTP requests (>24h)
  const otpResult = await prisma.otpRequest.deleteMany({
    where: {
      createdAt: { lt: oneDayAgo },
    },
  });
  console.log(`✓ Purged expired OTP verification requests: ${otpResult.count}`);

  // 2. Purge stale cancelled/expired ride requests (>30 days)
  const rideRequestResult = await prisma.rideRequest.deleteMany({
    where: {
      status: { in: ["CANCELLED", "EXPIRED"] },
      updatedAt: { lt: thirtyDaysAgo },
    },
  });
  console.log(`✓ Purged stale cancelled/expired ride requests: ${rideRequestResult.count}`);

  // 3. Purge historical audit logs (>1 year / 365 days)
  const auditResult = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: oneYearAgo },
    },
  });
  console.log(`✓ Purged historical system audit logs (>1y): ${auditResult.count}`);

  // 4. Log compliance audit event
  const audit = await prisma.auditLog.create({
    data: {
      action: "RETENTION_PURGE",
      entityType: "SYSTEM",
      entityId: "RETENTION_WORKER",
      after: JSON.stringify({
        purgedOtpCount: otpResult.count,
        purgedRideRequestCount: rideRequestResult.count,
        purgedOldAuditCount: auditResult.count,
        retentionPolicy: "DPDP_24H_OTP_30D_REQUESTS_365D_AUDIT",
        completedAt: new Date().toISOString(),
      }),
    },
  });
  console.log(`✓ Logged retention audit event ID: ${audit.id}`);

  console.log(`\n======================================================`);
  console.log(`✅ Retention job finished successfully.`);
  console.log(`======================================================\n`);

  return {
    purgedOtpCount: otpResult.count,
    purgedRideRequestCount: rideRequestResult.count,
    purgedOldAuditCount: auditResult.count,
    auditLogId: audit.id,
  };
}
