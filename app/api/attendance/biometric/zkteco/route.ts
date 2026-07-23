import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { riyadhWorkDate } from '@/lib/attendance/sites';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function authorized(request: NextRequest) {
  const expected = process.env.ATTENDANCE_BRIDGE_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') || request.headers.get('x-attendance-token') || '';
  return header === `Bearer ${expected}` || header === expected;
}

function clean(value: unknown) { return String(value ?? '').trim(); }

function note(payload: Record<string, unknown>) {
  return JSON.stringify({ source: 'ZKTECO_MAIN_BRANCH', branch: 'MAIN', ...payload, receivedAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) return NextResponse.json({ success: false, message: 'Unauthorized bridge' }, { status: 401 });
    const body = await request.json();
    const items = Array.isArray(body.records) ? body.records : [body];
    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      // Independent try/catch per punch: one bad/duplicate record (a stale
      // connection blip, a malformed device row) must never abort the rest
      // of the batch the device pushed in this request.
      try {
        const rawCode = clean(item.employeeNumber ?? item.userId ?? item.pin ?? item.uid ?? item.code);
        const nationalId = clean(item.nationalId ?? item.identificationId);
        const timestamp = item.timestamp ? new Date(String(item.timestamp)) : new Date();
        if (!rawCode && !nationalId) { results.push({ success: false, reason: 'missing employee code/nationalId' }); continue; }
        if (Number.isNaN(timestamp.getTime())) { results.push({ success: false, rawCode, reason: 'invalid timestamp' }); continue; }

        const employee = await prisma.employee.findFirst({
          where: { OR: [{ employeeNumber: rawCode }, { nationalId: rawCode }, ...(nationalId ? [{ nationalId }] : [])] },
          select: { id: true, employeeNumber: true, nationalId: true },
        });
        if (!employee) { results.push({ success: false, rawCode, nationalId, reason: 'employee not found' }); continue; }

        const workDate = riyadhWorkDate(timestamp);
        const existing = await prisma.attendanceRecord.findUnique({ where: { employeeId_workDate: { employeeId: employee.id, workDate } } });
        const deviceAction = clean(item.action ?? item.type ?? item.punchType).toLowerCase();
        const shouldCheckout = deviceAction.includes('out') || deviceAction.includes('checkout') || deviceAction === '1' || Boolean(existing?.checkIn && !existing?.checkOut);
        const payload = note({ employeeNumber: employee.employeeNumber, nationalId: employee.nationalId, deviceIp: body.deviceIp ?? item.deviceIp, deviceName: body.deviceName ?? 'ZKTeco Main Branch', raw: item });

        const record = shouldCheckout
          ? await prisma.attendanceRecord.upsert({
              where: { employeeId_workDate: { employeeId: employee.id, workDate } },
              update: { checkOut: timestamp, notes: payload },
              create: { employeeId: employee.id, workDate, checkOut: timestamp, status: 'PRESENT', notes: payload },
            })
          : await prisma.attendanceRecord.upsert({
              where: { employeeId_workDate: { employeeId: employee.id, workDate } },
              update: { checkIn: timestamp, status: 'PRESENT', notes: payload },
              create: { employeeId: employee.id, workDate, checkIn: timestamp, status: 'PRESENT', notes: payload },
            });
        results.push({ success: true, employeeId: employee.id, attendanceId: record.id, action: shouldCheckout ? 'checkout' : 'checkin' });
      } catch (itemError) {
        results.push({ success: false, rawItem: item, reason: itemError instanceof Error ? itemError.message : String(itemError) });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
