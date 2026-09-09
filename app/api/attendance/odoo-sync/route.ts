import { NextRequest, NextResponse } from 'next/server';
import { OdooSyncService } from '@/lib/integrations/odoo/sync';
import { hasValidInternalSyncToken } from '@/lib/internal-sync-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!hasValidInternalSyncToken(request)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const service = await OdooSyncService.forConnection(body.connectionId);
    const result = await service.sync({
      entity: body.entity || 'employees',
      direction: body.direction || 'ODOO_TO_HRMS',
      batchSize: Math.min(Math.max(Number(body.batchSize ?? 500), 50), 1000),
      incremental: body.incremental ?? false,
      dryRun: Boolean(body.dryRun),
    } as any);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
