import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const expectedTables = [
  "EmployeePreference",
  "ExpenseRequest",
  "LetterRequest",
  "WorkflowInstance",
  "WorkflowStep",
  "IntegrationSetting",
  "PlatformHealthMetric"
];

const repairStatements = [
  'DO $$ BEGIN CREATE TYPE "RequestStatus" AS ENUM (\'PENDING\', \'APPROVED\', \'REJECTED\', \'CANCELLED\'); EXCEPTION WHEN duplicate_object THEN null; END $$',
  'CREATE TABLE IF NOT EXISTS "EmployeePreference" ("id" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"theme" TEXT NOT NULL DEFAULT \'corporate\',"language" TEXT NOT NULL DEFAULT \'ar\',"timezone" TEXT NOT NULL DEFAULT \'Asia/Riyadh\',"notifications" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "EmployeePreference_pkey" PRIMARY KEY ("id"))',
  'CREATE TABLE IF NOT EXISTS "ExpenseRequest" ("id" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"category" TEXT NOT NULL,"description" TEXT,"receiptUrl" TEXT,"status" "RequestStatus" NOT NULL DEFAULT \'PENDING\',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ExpenseRequest_pkey" PRIMARY KEY ("id"))',
  'CREATE TABLE IF NOT EXISTS "LetterRequest" ("id" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"letterType" TEXT NOT NULL,"purpose" TEXT,"status" "RequestStatus" NOT NULL DEFAULT \'PENDING\',"fileUrl" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "LetterRequest_pkey" PRIMARY KEY ("id"))',
  'CREATE TABLE IF NOT EXISTS "WorkflowInstance" ("id" TEXT NOT NULL,"employeeId" TEXT NOT NULL,"type" TEXT NOT NULL,"entityId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT \'PENDING\',"currentStep" INTEGER NOT NULL DEFAULT 1,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id"))',
  'CREATE TABLE IF NOT EXISTS "WorkflowStep" ("id" TEXT NOT NULL,"workflowInstanceId" TEXT NOT NULL,"step" INTEGER NOT NULL,"approverUserId" TEXT,"status" TEXT NOT NULL DEFAULT \'PENDING\',"approvedAt" TIMESTAMP(3),"comments" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id"))',
  'CREATE TABLE IF NOT EXISTS "IntegrationSetting" ("id" TEXT NOT NULL PRIMARY KEY,"providerId" TEXT,"key" TEXT NOT NULL,"value" JSONB NOT NULL,"isSecret" BOOLEAN NOT NULL DEFAULT false,"description" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS "PlatformHealthMetric" ("id" TEXT NOT NULL PRIMARY KEY,"service" TEXT NOT NULL,"metric" TEXT NOT NULL,"value" DOUBLE PRECISION NOT NULL,"unit" TEXT,"status" TEXT NOT NULL DEFAULT \'OK\',"traceId" TEXT,"metadata" JSONB,"capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE UNIQUE INDEX IF NOT EXISTS "EmployeePreference_employeeId_key" ON "EmployeePreference"("employeeId")',
  'CREATE INDEX IF NOT EXISTS "ExpenseRequest_employeeId_idx" ON "ExpenseRequest"("employeeId")',
  'CREATE INDEX IF NOT EXISTS "ExpenseRequest_status_idx" ON "ExpenseRequest"("status")',
  'CREATE INDEX IF NOT EXISTS "LetterRequest_employeeId_idx" ON "LetterRequest"("employeeId")',
  'CREATE INDEX IF NOT EXISTS "LetterRequest_status_idx" ON "LetterRequest"("status")',
  'CREATE INDEX IF NOT EXISTS "WorkflowInstance_employeeId_idx" ON "WorkflowInstance"("employeeId")',
  'CREATE INDEX IF NOT EXISTS "WorkflowInstance_status_idx" ON "WorkflowInstance"("status")',
  'CREATE INDEX IF NOT EXISTS "WorkflowStep_workflowInstanceId_idx" ON "WorkflowStep"("workflowInstanceId")',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationSetting_providerId_key_key" ON "IntegrationSetting"("providerId", "key")',
  'CREATE INDEX IF NOT EXISTS "IntegrationSetting_key_idx" ON "IntegrationSetting"("key")',
  'CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_service_idx" ON "PlatformHealthMetric"("service")',
  'CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_metric_idx" ON "PlatformHealthMetric"("metric")',
  'CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_status_idx" ON "PlatformHealthMetric"("status")',
  'CREATE INDEX IF NOT EXISTS "PlatformHealthMetric_capturedAt_idx" ON "PlatformHealthMetric"("capturedAt")',
  'DO $$ BEGIN ALTER TABLE "EmployeePreference" ADD CONSTRAINT "EmployeePreference_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$',
  'DO $$ BEGIN ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$',
  'DO $$ BEGIN ALTER TABLE "LetterRequest" ADD CONSTRAINT "LetterRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$',
  'DO $$ BEGIN ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$',
  'DO $$ BEGIN ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$',
  'DO $$ BEGIN ALTER TABLE "IntegrationSetting" ADD CONSTRAINT "IntegrationSetting_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$'
];

function dbUrlInfo() {
  const raw = process.env.DATABASE_URL || "";
  try {
    const url = new URL(raw);
    return { present: Boolean(raw), protocol: url.protocol.replace(":", ""), hostname: url.hostname, database: url.pathname.replace(/^\//, ""), isSupabase: /supabase|pooler/i.test(url.hostname) };
  } catch {
    return { present: Boolean(raw), protocol: null, hostname: null, database: null, isSupabase: false };
  }
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(session.user.roles || []).includes("SUPER_ADMIN")) throw new Error("Forbidden");
  return session;
}

async function inspect() {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY table_name`,
    expectedTables
  );
  const existing = rows.map((row) => row.table_name);
  const missing = expectedTables.filter((table) => !existing.includes(table));
  const db = await prisma.$queryRawUnsafe<Array<{ current_database: string; current_schema: string }>>(`SELECT current_database(), current_schema()`);
  return { databaseUrl: dbUrlInfo(), database: db[0], existing, missing };
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await inspect());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "APPLY_SCHEMA_REPAIR") return NextResponse.json({ success: false, message: "Missing confirmation" }, { status: 400 });
    const before = await inspect();
    for (const statement of repairStatements) {
      await prisma.$executeRawUnsafe(statement);
    }
    const after = await inspect();
    return NextResponse.json({ success: true, before, after });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}
