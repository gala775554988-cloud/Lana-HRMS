import { NextRequest, NextResponse } from "next/server";
import { enqueueSync } from "@/lib/integrations/service";
import { OdooSyncService, requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import type { SyncOptions } from "@/lib/integrations/odoo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const body = await request.json().catch(() => ({}));
    if (body.queue) {
      const queued = await enqueueSync({
        connectionId: body.connectionId,
        mappingId: body.mappingId,
        direction: body.direction || "BIDIRECTIONAL",
        entity: body.entity || "all",
        payload: { dryRun: Boolean(body.dryRun), batchSize: body.batchSize, incremental: body.incremental, since: body.since }
      });
      return NextResponse.json({ success: true, queued });
    }

    const service = await OdooSyncService.forConnection(body.connectionId);
    const result = await service.sync(body as SyncOptions);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
