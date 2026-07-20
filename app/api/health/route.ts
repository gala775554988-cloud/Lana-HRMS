import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOdooIntegrationEnabled } from "@/lib/settings";
import { OdooClient } from "@/lib/integrations/odoo/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckResult = { status: "OK" | "DOWN" | "DISABLED" | "N/A"; ms?: number; message?: string; note?: string };

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "OK", ms: Date.now() - started };
  } catch (error) {
    return { status: "DOWN", ms: Date.now() - started, message: error instanceof Error ? error.message.split("\n")[0] : String(error) };
  }
}

async function checkOdoo(): Promise<CheckResult> {
  const started = Date.now();
  try {
    if (!(await isOdooIntegrationEnabled())) return { status: "DISABLED" };
    await OdooClient.fromEnv().version();
    return { status: "OK", ms: Date.now() - started };
  } catch (error) {
    return { status: "DOWN", ms: Date.now() - started, message: error instanceof Error ? error.message.split("\n")[0] : String(error) };
  }
}

// This project has no dedicated blob/object storage service -- uploaded
// documents are stored as URLs or inline payloads directly in Postgres
// (see EmployeeDocument.fileUrl), so storage health is database health.
function checkStorage(): CheckResult {
  return { status: "N/A", note: "No separate blob storage configured; documents are stored via the database." };
}

export async function GET() {
  const [database, odoo] = await Promise.all([checkDatabase(), checkOdoo()]);
  const storage = checkStorage();
  const overall = database.status === "OK" ? "OK" : "DEGRADED";

  const body = {
    status: overall,
    timestamp: new Date().toISOString(),
    checks: { database, prisma: database, odoo, storage }
  };

  if (database.status !== "OK") {
    await prisma.integrationLog.create({
      data: { action: "HEALTH_CHECK_FAILURE", level: "ERROR", message: JSON.stringify(body).slice(0, 500) }
    }).catch(() => null);
  }

  return NextResponse.json(body, { status: 200 });
}
