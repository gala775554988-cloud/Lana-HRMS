import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEmployee } from '@/lib/employee/portal';
import { findAllowedSiteForEmployee, riyadhWorkDate } from '@/lib/attendance/sites';
import { writeAuditLog } from '@/lib/audit';
import { verifyOrBindEmployeeDevice } from '@/lib/cache/device-cache';

function notePayload(input: Record<string, unknown>) {
  return JSON.stringify({ ...input, recordedAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  try {
    const { employee, session } = await requireEmployee();
    const body = await request.json();

    // 1. High-speed Redis / In-Memory check (< 50ms) for mobile device binding
    const deviceCheck = await verifyOrBindEmployeeDevice(employee.id, body.deviceId || request.headers.get('x-device-id'), 'mobile');
    if (!deviceCheck.allowed) {
      return NextResponse.json({ success: false, message: deviceCheck.reason || 'هذا الحساب مربوط بجهاز جوال آخر بالفعل. يرجى التواصل مع إدارة الموارد البشرية لفك الارتباط قبل الدخول من هذا الجهاز.' }, { status: 403 });
    }

    const action = body.action === 'checkout' ? 'checkout' : 'checkin';
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ success: false, message: 'الموقع GPS مطلوب لتسجيل الحضور من الجوال' }, { status: 400 });
    }

    const fullEmployee = await prisma.employee.findUnique({
      where: { id: employee.id },
      select: {
        id: true, firstName: true, lastName: true, employeeNumber: true, nationalId: true, email: true, phone: true, sponsor: true,
        department: { select: { name: true } }, branch: { select: { name: true } }, position: { select: { title: true } },
      },
    });
    if (!fullEmployee) return NextResponse.json({ success: false, message: 'Employee not found' }, { status: 404 });

    const siteResult = await findAllowedSiteForEmployee(fullEmployee, { latitude, longitude }, body.siteId ? String(body.siteId) : undefined);
    if (!siteResult.allowed) {
      const nearest = siteResult.checked.sort((a, b) => a.distance - b.distance)[0];
      return NextResponse.json({
        success: false,
        message: nearest
          ? `لا يمكن تسجيل الحضور: ${nearest.employeeAllowed ? 'أنت خارج النطاق المسموح' : 'أنت غير مربوط بهذا الموقع'} (${nearest.distance}م)`
          : 'لا يوجد موقع حضور فعال مطابق للموظف',
        checked: siteResult.checked.map((item) => ({ siteId: item.site.id, siteName: item.site.name, distance: item.distance, radius: item.site.radiusMeters, employeeAllowed: item.employeeAllowed, inside: item.inside })),
      }, { status: 403 });
    }

    const now = new Date();
    const workDate = riyadhWorkDate(now);
    const note = notePayload({
      source: 'MOBILE_GEOFENCE',
      action,
      siteId: siteResult.site.id,
      siteName: siteResult.site.name,
      latitude,
      longitude,
      distanceMeters: siteResult.distance,
      allowedRadiusMeters: siteResult.site.radiusMeters,
      assignmentType: siteResult.site.assignmentType,
      assignmentValue: siteResult.site.assignmentValue,
      verification: body.biometric === true ? 'DEVICE_BIOMETRIC_CONFIRMED' : 'GPS_SESSION',
      userAgent: request.headers.get('user-agent')?.slice(0, 300),
    });

    const record = action === 'checkin'
      ? await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
          update: { checkIn: now, status: 'PRESENT', notes: note },
          create: { employeeId: employee.id, workDate, checkIn: now, status: 'PRESENT', notes: note },
        })
      : await prisma.attendanceRecord.upsert({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
          update: { checkOut: now, notes: note },
          create: { employeeId: employee.id, workDate, checkOut: now, status: 'PRESENT', notes: note },
        });

    await writeAuditLog({ actorUserId: session.user.id, action: `mobile-attendance:${action}`, entity: 'AttendanceRecord', entityId: record.id, metadata: { employeeId: employee.id, siteId: siteResult.site.id, distanceMeters: siteResult.distance } }).catch(() => undefined);
    return NextResponse.json({ success: true, recordId: record.id, action, site: siteResult.site, distanceMeters: siteResult.distance, checkIn: record.checkIn, checkOut: record.checkOut });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
