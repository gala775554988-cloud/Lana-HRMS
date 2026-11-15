import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncOdooRequests, approvalRequestForApprover } from '@/lib/integrations/odoo/requests/service';
import { WEBHOOK_KEY } from '@/lib/integrations/odoo/requests/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function POST(request: Request) {
  const setting = await prisma.appSetting.findUnique({ where: { key: WEBHOOK_KEY }, select: { value: true } });
  const expected = (setting?.value as { hash?: string } | undefined)?.hash;
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9]+)$/)?.[1];
  if (!expected || !token || token.length > 256) return NextResponse.json({ success: false }, { status: 401 });
  const actual = createHash('sha256').update(token).digest('hex');
  if (expected.length !== actual.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return NextResponse.json({ success: false }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 8192) return NextResponse.json({ success: false }, { status: 413 });
  try {
    const incoming = JSON.parse(raw);
    const body = { model: incoming.model ?? incoming._model, id: incoming.id ?? incoming._id };
    if (typeof body.model !== 'string' || !Number.isSafeInteger(body.id) || body.id <= 0) return NextResponse.json({ success: false }, { status: 400 });
    // Ignore supplied status/owner/amount: always read the authoritative record.
    const target = body.model === 'approval.approver' ? await approvalRequestForApprover(body.id) : {model:body.model,id:body.id};
    const result = await syncOdooRequests(target);
    const accepted = result.enabled && !result.errors.length && result.imported > 0;
    if (accepted) await prisma.appSetting.upsert({ where: { key: 'odoo.requests.webhook.last' }, create: { key: 'odoo.requests.webhook.last', value: { at: new Date().toISOString(), keyHash: expected } }, update: { value: { at: new Date().toISOString(), keyHash: expected } } });
    return NextResponse.json({ success: accepted }, { status: accepted ? 200 : 503 });
  } catch { return NextResponse.json({ success: false }, { status: 503 }); }
}
