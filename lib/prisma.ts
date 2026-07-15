import { PrismaClient } from "@prisma/client";

let schemaChecked = false;

async function ensureSchemaReady(client: PrismaClient) {
  if (schemaChecked) return;
  schemaChecked = true;
  try {
    const sqlStatements = [
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
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  setTimeout(() => ensureSchemaReady(client).catch(() => {}), 100);
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
