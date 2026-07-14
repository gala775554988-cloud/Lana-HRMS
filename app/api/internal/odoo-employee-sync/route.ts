import { NextRequest, NextResponse } from 'next/server';
import { OdooSyncService } from '@/lib/integrations/odoo/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const expected = process.env.ATTENDANCE_BRIDGE_TOKEN || process.env.INTERNAL_SYNC_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') || request.headers.get('x-internal-sync-token') || '';
  return header === `Bearer ${expected}` || header === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const service = await OdooSyncService.forConnection(body.connectionId);
    const result = await service.sync({
      entity: body.entity || 'employees',
      direction: body.direction || 'ODOO_TO_HRMS',
      batchSize: Math.min(Math.max(Number(body.batchSize ?? 500), 50), 1000),
      incremental: body.incremental ?? false,
      dryRun: Boolean(body.dryRun),
      maxPages: body.maxPages,
    } as any);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
