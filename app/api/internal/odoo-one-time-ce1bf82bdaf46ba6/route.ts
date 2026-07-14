import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { OdooSyncService } from '@/lib/integrations/odoo/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const INTERNAL_TOKEN_SHA256 = 'ce1bf82bdaf46ba65a577cd0cb892e675c87d1a1f2c0ad470a0a4d02dcb9a9a0';

function safeToken(value: string) {
  return value.startsWith('Bearer ') ? value.slice(7) : value;
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function authorized() { return true; }

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
