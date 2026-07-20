import { PrismaClient } from "@prisma/client";

let schemaChecked = false;

async function ensureSchemaReady(client: PrismaClient) {
  if (schemaChecked || process.env.NEXT_PHASE === "phase-production-build" || process.env.SKIP_AUTO_DDL === "true") return;
  schemaChecked = true;
  try {
    const sqlStatements = [
      `CREATE TABLE IF NOT EXISTS "HrPermissionScope" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "module" TEXT NOT NULL,
        "scope" TEXT NOT NULL DEFAULT 'ALL',
        "branchId" TEXT,
        "departmentId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "HrPermissionScope_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE TABLE IF NOT EXISTS "HrPermissionAudit" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "module" TEXT,
        "oldValue" TEXT,
        "newValue" TEXT,
        "byUserId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HrPermissionAudit_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE INDEX IF NOT EXISTS "HrPermissionScope_userId_idx" ON "HrPermissionScope"("userId");`,
      `CREATE INDEX IF NOT EXISTS "HrPermissionScope_module_idx" ON "HrPermissionScope"("module");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "HrPermissionScope_userId_module_key" ON "HrPermissionScope"("userId", "module");`,
      `CREATE INDEX IF NOT EXISTS "HrPermissionAudit_userId_idx" ON "HrPermissionAudit"("userId");`,
      `CREATE INDEX IF NOT EXISTS "HrPermissionAudit_createdAt_idx" ON "HrPermissionAudit"("createdAt");`,
      `CREATE TABLE IF NOT EXISTS "EmployeeMobileDevice" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "platform" TEXT NOT NULL DEFAULT 'mobile',
        "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EmployeeMobileDevice_pkey" PRIMARY KEY ("id")
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_key" ON "EmployeeMobileDevice"("employeeId");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeMobileDevice_deviceId_key" ON "EmployeeMobileDevice"("deviceId");`,
      `CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_deviceId_idx" ON "EmployeeMobileDevice"("employeeId", "deviceId");`,
      `CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_deviceId_idx" ON "EmployeeMobileDevice"("deviceId");`,
      `ALTER TABLE "EmployeeMobileDevice" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;`,
      `ALTER TABLE "EmployeeMobileDevice" ADD COLUMN IF NOT EXISTS "pushSubscription" JSONB;`,
      `ALTER TABLE "HrPermissionScope" ADD COLUMN IF NOT EXISTS "hospitalId" TEXT;`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "sponsor" TEXT;`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooRawData" JSONB;`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "odooRawDataSyncedAt" TIMESTAMP(3);`,
      `ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';`,
      `ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "odooAttachmentId" INTEGER;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDocument_odooAttachmentId_key" ON "EmployeeDocument"("odooAttachmentId");`,
      `ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "odooRawData" JSONB;`,
      `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "odooPayslipId" INTEGER;`,
      `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "odooRawData" JSONB;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PayrollItem_odooPayslipId_key" ON "PayrollItem"("odooPayslipId");`,
      `ALTER TABLE "Allowance" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';`,
      `ALTER TABLE "Allowance" ADD COLUMN IF NOT EXISTS "odooPayslipLineId" INTEGER;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Allowance_odooPayslipLineId_key" ON "Allowance"("odooPayslipLineId");`,
      `ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';`,
      `ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "odooPayslipLineId" INTEGER;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Deduction_odooPayslipLineId_key" ON "Deduction"("odooPayslipLineId");`,
      `ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3);`,
      `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "key" TEXT;`,
      `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;`,
      `ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "parentId" TEXT;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PermissionGroup_key_key" ON "PermissionGroup"("key");`,
      `CREATE INDEX IF NOT EXISTS "PermissionGroup_key_idx" ON "PermissionGroup"("key");`,
      `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      `CREATE INDEX IF NOT EXISTS "Employee_firstName_trgm_idx" ON "Employee" USING GIN ("firstName" gin_trgm_ops);`,
      `CREATE INDEX IF NOT EXISTS "Employee_lastName_trgm_idx" ON "Employee" USING GIN ("lastName" gin_trgm_ops);`,
      `CREATE INDEX IF NOT EXISTS "Employee_employeeNumber_trgm_idx" ON "Employee" USING GIN ("employeeNumber" gin_trgm_ops);`,
      `CREATE INDEX IF NOT EXISTS "Employee_nationalId_trgm_idx" ON "Employee" USING GIN ("nationalId" gin_trgm_ops);`,
      `CREATE INDEX IF NOT EXISTS "Employee_email_trgm_idx" ON "Employee" USING GIN ("email" gin_trgm_ops);`,
      `CREATE INDEX IF NOT EXISTS "Employee_phone_trgm_idx" ON "Employee" USING GIN ("phone" gin_trgm_ops);`
    ];
    for (const sql of sqlStatements) {
      try {
        await client.$executeRawUnsafe(sql);
      } catch {}
    }
  } catch {}
}

const prismaClientSingleton = () => {
  const rawDbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.DIRECT_URL || "";
  const dbUrl = rawDbUrl.trim();
  if (!dbUrl) {
    console.warn("[Prisma] Neither POSTGRES_PRISMA_URL nor DATABASE_URL is set in environment variables");
  }

  const client = new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Production already gets this exact schema-heal DDL once, safely, at
  // deploy time (scripts/ensure-db-schema.mjs runs in the vercel-build
  // step before any traffic is served). Re-running it here on every cold
  // serverless start in production is pure redundancy that only adds risk:
  // concurrent "IF NOT EXISTS" ALTER TABLE/CREATE INDEX statements from
  // multiple simultaneous cold starts can race for catalog locks on
  // Postgres and error out -- a very plausible source of the intermittent,
  // non-reproducible "Server Components render" crashes users have hit,
  // since it fires on effectively every page that resolves a session.
  // Keep it for local dev only, where there's no separate build step.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.SKIP_AUTO_DDL !== "true") {
    setTimeout(() => ensureSchemaReady(client).catch(() => {}), 100);
  }
  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export { prisma, ensureSchemaReady };
