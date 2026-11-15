import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasValidInternalSyncToken } from '@/lib/internal-sync-auth';
import { canManageApprovalRouting } from '@/config/request-routing';
import { retryPendingRequests, syncOdooRequests } from '@/lib/integrations/odoo/requests/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const cron = !!process.env.CRON_SECRET && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cron && !hasValidInternalSyncToken(request)) {
    const session = await auth();
    if (!session?.user?.id || !canManageApprovalRouting(session.user.roles, session.user.permissions)) return NextResponse.json({ success: false }, { status: 401 });
  }
  try { await retryPendingRequests(5); const result = await syncOdooRequests(); return NextResponse.json({ success: !result.errors.length, result }, { status: result.errors.length ? 422 : 200 }); }
  catch { return NextResponse.json({ success: false, message: 'تعذرت المزامنة. تحقق من المصدر والحقول والصلاحيات.' }, { status: 503 }); }
}
export const POST = GET;
