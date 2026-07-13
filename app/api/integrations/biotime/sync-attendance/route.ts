import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOdooIntegrationAccess } from '@/lib/integrations/odoo/sync';
import { riyadhWorkDate } from '@/lib/attendance/sites';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

type BioTimeTransaction = {
  id?: number;
  emp_code?: string;
  punch_time?: string;
  punch_state?: string | number;
  punch_state_display?: string;
  terminal_sn?: string;
  terminal_alias?: string;
  area_alias?: string;
  verify_type_display?: string;
  [key: string]: unknown;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function todayRange(dateText?: string) {
  const base = dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  return { startTime: `${base} 00:00:00`, endTime: `${base} 23:59:59`, date: base };
}

function bioTimeUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function bioTimeLogin(baseUrl: string, username: string, password: string) {
  const response = await fetch(bioTimeUrl(baseUrl, '/jwt-api-token-auth/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.token) throw new Error(`BioTime login failed: HTTP ${response.status}`);
  return String(json.token);
}

function transactionAction(row: BioTimeTransaction) {
  const state = clean(row.punch_state).toLowerCase();
  const display = clean(row.punch_state_display).toLowerCase();
  if (state === '0' || display.includes('check in')) return 'checkin' as const;
  if (state === '1' || display.includes('check out')) return 'checkout' as const;
  return null;
}

function note(row: BioTimeTransaction, action: string) {
  return JSON.stringify({
    source: 'BIOTIME_9_5',
    action,
    empCode: row.emp_code,
    bioTimeTransactionId: row.id,
    terminalSn: row.terminal_sn,
    terminalAlias: row.terminal_alias,
    areaAlias: row.area_alias,
    verifyType: row.verify_type_display,
    punchState: row.punch_state,
    punchStateDisplay: row.punch_state_display,
    syncedAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOdooIntegrationAccess('manage');
    const body = await request.json().catch(() => ({}));
    const baseUrl = clean(body.baseUrl || process.env.BIOTIME_URL || 'https://handbook-latino-trout-settle.trycloudflare.com');
    if (!baseUrl) return NextResponse.json({ success: false, message: 'BioTime URL is required' }, { status: 400 });

    const username = clean(body.username || process.env.BIOTIME_USERNAME || 'HR');
    const password = clean(body.password || process.env.BIOTIME_PASSWORD || 'Lana@123');
    const range = todayRange(clean(body.date));
    const startTime = clean(body.startTime) || range.startTime;
    const endTime = clean(body.endTime) || range.endTime;
    const terminalAlias = clean(body.terminalAlias || 'جهاز الحضور والأنصراف');
    const pageSize = Math.min(Math.max(Number(body.pageSize || 100), 10), 500);
    const maxPages = Math.min(Math.max(Number(body.maxPages || 50), 1), 200);
    const dryRun = Boolean(body.dryRun);

    const token = await bioTimeLogin(baseUrl, username, password);
    const allRows: BioTimeTransaction[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(bioTimeUrl(baseUrl, '/iclock/api/transactions/'));
      url.searchParams.set('page', String(page));
      url.searchParams.set('page_size', String(pageSize));
      url.searchParams.set('start_time', startTime);
      url.searchParams.set('end_time', endTime);
      if (terminalAlias) url.searchParams.set('terminal_alias', terminalAlias);
      const response = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` }, cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`BioTime transactions failed: HTTP ${response.status}`);
      const rows = Array.isArray(json.data) ? json.data as BioTimeTransaction[] : [];
      allRows.push(...rows);
      if (!json.next || rows.length === 0) break;
    }

    let saved = 0;
    let checkins = 0;
    let checkouts = 0;
    let skippedUnknownState = 0;
    const notFound: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];
    const samples: Array<Record<string, unknown>> = [];

    for (const row of allRows) {
      const empCode = clean(row.emp_code);
      const punchTime = clean(row.punch_time);
      const action = transactionAction(row);
      if (!action) { skippedUnknownState += 1; continue; }
      if (!empCode || !punchTime) { errors.push({ id: row.id, empCode, reason: 'missing emp_code or punch_time' }); continue; }
      const timestamp = new Date(punchTime.replace(' ', 'T') + '+03:00');
      if (Number.isNaN(timestamp.getTime())) { errors.push({ id: row.id, empCode, punchTime, reason: 'invalid punch_time' }); continue; }

      const employee = await prisma.employee.findFirst({
        where: { OR: [{ employeeNumber: empCode }, { nationalId: empCode }] },
        select: { id: true, employeeNumber: true, nationalId: true },
      });
      if (!employee) {
        notFound.push({ empCode, transactionId: row.id, punchTime, terminalAlias: row.terminal_alias });
        continue;
      }
      if (dryRun) { samples.push({ empCode, employeeId: employee.id, action, punchTime, transactionId: row.id }); continue; }

      const workDate = riyadhWorkDate(timestamp);
      const dataNote = note(row, action);
      if (action === 'checkout') {
        await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
          update: { checkOut: timestamp, notes: dataNote },
          create: { employeeId: employee.id, workDate, checkOut: timestamp, status: 'PRESENT', notes: dataNote },
        });
        checkouts += 1;
      } else {
        await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
          update: { checkIn: timestamp, status: 'PRESENT', notes: dataNote },
          create: { employeeId: employee.id, workDate, checkIn: timestamp, status: 'PRESENT', notes: dataNote },
        });
        checkins += 1;
      }
      saved += 1;
    }

    const result = {
      success: true,
      baseUrl,
      date: range.date,
      startTime,
      endTime,
      terminalAlias,
      fetched: allRows.length,
      saved,
      checkins,
      checkouts,
      skippedUnknownState,
      notFoundCount: notFound.length,
      errorsCount: errors.length,
      notFound: notFound.slice(0, 50),
      errors: errors.slice(0, 50),
      dryRun,
      samples: samples.slice(0, 50),
    };

    await writeAuditLog({ actorUserId: session.user.id, action: 'biotime-attendance:sync', entity: 'BioTimeAttendance', entityId: range.date, metadata: result as any }).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
