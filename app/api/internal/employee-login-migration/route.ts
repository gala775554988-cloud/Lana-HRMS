import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { OdooClient } from "@/lib/integrations/odoo/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const expected = process.env.EMPLOYEE_LOGIN_MIGRATION_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || expected.length < 32 || provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const operation = (await request.json().catch(() => ({}))).operation;
  if (!["inspect", "migrate", "mail-inspect"].includes(operation)) return NextResponse.json({ success: false }, { status: 400 });
  if (operation === "mail-inspect") {
    const configured = Boolean(process.env.ODOO_URL && process.env.ODOO_DATABASE && process.env.ODOO_USERNAME && (process.env.ODOO_PASSWORD || process.env.ODOO_API_KEY));
    if (!configured) return NextResponse.json({ success: false, odooConfigured: false });
    try {
      const client = OdooClient.fromEnv({ timeoutMs: 15000, maxRetries: 0 });
      const canCreate = await client.executeKw<boolean>("mail.mail", "check_access_rights", ["create"], { raise_exception: false });
      const canRead = await client.executeKw<boolean>("mail.mail", "check_access_rights", ["read"], { raise_exception: false });
      return NextResponse.json({ success: true, odooConfigured: true, canCreate, canRead });
    } catch { return NextResponse.json({ success: false, odooConfigured: true, message: "Odoo mail capability check failed" }, { status: 502 }); }
  }
  const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) return NextResponse.json({ success: false, message: "Database not configured" }, { status: 503 });
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    if (operation === "migrate") await client.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`);
      await tx.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginEmail" TEXT, ADD COLUMN IF NOT EXISTS "loginEmailVerifiedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "employeePasswordMode" TEXT NOT NULL DEFAULT 'IDENTITY_SUFFIX', ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_loginEmail_key" ON "User"("loginEmail")`);
      await tx.auditLog.create({ data: { action: "database:employee_login_migrated", entity: "User", metadata: { migration: "20261028000100_employee_login_enrollment", source: "authorized-deployment" } } });
    }, { timeout: 30000 });
    const columns = await client.$queryRawUnsafe<Array<{ column_name: string }>>(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name IN ('loginEmail','loginEmailVerifiedAt','employeePasswordMode','sessionVersion') ORDER BY column_name`);
    const indexes = await client.$queryRawUnsafe<Array<{ indexname: string }>>(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_loginEmail_key'`);
    const ready = columns.length === 4 && indexes.length === 1;
    return NextResponse.json({ success: true, ready, columns: columns.map(c => c.column_name), uniqueIndex: indexes.length === 1 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ success: false, message: "Employee login schema operation failed" }, { status: 500 }); }
  finally { await client.$disconnect(); }
}
