import { NextRequest, NextResponse } from "next/server";
import { OdooSyncService } from "@/lib/integrations/odoo/sync";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Triggered by Vercel Cron (see vercel.json "crons"). Vercel sends
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set
// as a project environment variable — this is the only auth check here since
// there is no logged-in user for a scheduled invocation.
function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const service = await OdooSyncService.forConnection(request.nextUrl.searchParams.get("connectionId") || undefined);
    const result = await service.sync({ entity: "all", direction: "BIDIRECTIONAL" });
    await writeAuditLog({ action: "ODOO_CRON_SYNC", entity: "odoo", metadata: { entity: result.entity, pulled: result.pulled, pushed: result.pushed, created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length } }).catch(() => undefined);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
