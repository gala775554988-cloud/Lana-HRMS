import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { riyadhWorkDate } from '@/lib/attendance/sites';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Receiver for the local scripts/zkbio-attendance-sync.mjs bridge, which polls
// ZKBio Time's REST API from inside the office LAN and relays new punches here
// over HTTPS. Kept separate from app/api/attendance/biometric/zkteco/route.ts
// (a different, already-working push-based bridge for another branch/device)
// so the two integrations never share state or a secret.
function authorized(request: NextRequest) {
  const expected = process.env.ZKBIO_SYNC_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${expected}`;
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.records) ? body.records : [];
    if (!items.length) {
      return NextResponse.json({ success: true, processed: 0, results: [] });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      // Independent try/catch per punch -- one malformed or unmatched record
      // must never abort the rest of the batch.
      try {
        const empCode = clean(item.emp_code ?? item.empCode ?? item.employeeNumber ?? item.emp_id ?? item.pin);
        if (!empCode) {
          results.push({ success: false, reason: 'missing emp_code on this record', raw: item });
          continue;
        }

        const punchRaw = item.punch_time ?? item.punchTime ?? item.timestamp;
        const timestamp = punchRaw ? new Date(String(punchRaw)) : null;
        if (!timestamp || Number.isNaN(timestamp.getTime())) {
          results.push({ success: false, empCode, reason: `unparseable punch_time: ${JSON.stringify(punchRaw)}`, raw: item });
          continue;
        }

        const employee = await prisma.employee.findFirst({
          where: { OR: [{ employeeNumber: empCode }, { nationalId: empCode }] },
          select: { id: true, employeeNumber: true },
        });
        if (!employee) {
          results.push({ success: false, empCode, reason: 'no matching Employee.employeeNumber/nationalId' });
          continue;
        }

        const workDate = riyadhWorkDate(timestamp);
        const existing = await prisma.attendanceRecord.findUnique({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        });
        // Same heuristic as the sibling ZKTeco push bridge: first punch of the
        // day is check-in, the next one (once a check-in exists without a
        // check-out yet) is treated as check-out.
        const shouldCheckout = Boolean(existing?.checkIn && !existing?.checkOut);
        const notes = JSON.stringify({ source: 'ZKBIO_TIME_POLL', empCode, raw: item, receivedAt: new Date().toISOString() });

        const record = shouldCheckout
          ? await prisma.attendanceRecord.upsert({
              where: { employeeId_workDate: { employeeId: employee.id, workDate } },
              update: { checkOut: timestamp, notes },
              create: { employeeId: employee.id, workDate, checkOut: timestamp, status: 'PRESENT', notes },
            })
          : await prisma.attendanceRecord.upsert({
              where: { employeeId_workDate: { employeeId: employee.id, workDate } },
              update: { checkIn: timestamp, status: 'PRESENT', notes },
              create: { employeeId: employee.id, workDate, checkIn: timestamp, status: 'PRESENT', notes },
            });
        results.push({ success: true, employeeId: employee.id, attendanceId: record.id, action: shouldCheckout ? 'checkout' : 'checkin' });
      } catch (itemError) {
        results.push({ success: false, raw: item, reason: itemError instanceof Error ? itemError.message : String(itemError) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    await writeAuditLog({
      action: 'ZKBIO_ATTENDANCE_SYNC',
      entity: 'AttendanceRecord',
      metadata: { received: items.length, succeeded: successCount, failed: items.length - successCount, results },
    }).catch(() => {});

    return NextResponse.json({ success: true, processed: items.length, succeeded: successCount, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
