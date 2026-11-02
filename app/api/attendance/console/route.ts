import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getAccessProfile, applyScopedWhere } from "@/lib/enterprise/hierarchy";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { readAttendanceFilters, attendanceWhere, attendanceExceptions, attendanceTiming, deviceMetadata } from "@/lib/attendance/console";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "يلزم تسجيل الدخول" }, { status: 401 });
  const roles = session.user.roles || [];
  const permissions = session.user.permissions || [];
  const hr = roles.includes("HR_MANAGER") || roles.includes("SUPER_ADMIN");
  if (!isEnterpriseResourceAllowed(roles, "attendance") || (!hr && !hasPermission(permissions, { action: "read", resource: "attendance" }, roles) && !hasPermission(permissions, { action: "manage", resource: "attendance" }, roles))) return NextResponse.json({ success: false, message: "لا تملك صلاحية عرض الحضور" }, { status: 403 });
  let filters;
  try { filters = readAttendanceFilters(request.nextUrl.searchParams); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "فلاتر غير صحيحة" }, { status: 400 }); }
  try {
    const profile = await getAccessProfile(session.user.id, roles);
    const scoped = await applyScopedWhere("attendance", {}, profile) as Prisma.AttendanceRecordWhereInput;
    const base = attendanceWhere(filters, scoped);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
    const exceptions: Prisma.AttendanceRecordWhereInput = { OR: [attendanceExceptions(today), { checkOut: { lt: prisma.attendanceRecord.fields.checkIn } }] };
    const where: Prisma.AttendanceRecordWhereInput = filters.view === "exceptions" ? { AND: [base, exceptions] } : base;
    const exportAll = request.nextUrl.searchParams.get("report") === "1";
    const [total, groups, missingOut, exceptionCount, branches, latest] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
      prisma.attendanceRecord.count({ where: { AND: [base, { checkIn: { not: null }, checkOut: null }] } }),
      prisma.attendanceRecord.count({ where: { AND: [base, exceptions] } }),
      prisma.branch.findMany({ where: { employees: { some: await applyScopedWhere("employees", {}, profile) } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.attendanceRecord.findFirst({ where: base, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })
    ]);
    if (exportAll && total > 20000) return NextResponse.json({ success: false, message: "الكشف يتجاوز 20,000 سجل. حدد فترة أو فرعًا أصغر لتصدير جميع النتائج دون اقتطاع." }, { status: 400 });
    const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
    const page = Math.min(filters.page, pageCount);
    const rows = await prisma.attendanceRecord.findMany({
      where, orderBy: [{ workDate: "desc" }, { id: "desc" }], skip: exportAll ? 0 : (page - 1) * filters.pageSize, take: exportAll ? Math.max(total, 1) : filters.pageSize,
      select: { id: true, workDate: true, checkIn: true, checkOut: true, status: true, notes: true, updatedAt: true, employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, branch: { select: { name: true } }, department: { select: { name: true } } } } }
    });
    const ids = Array.from(new Set(rows.map(row => row.employee.id)));
    const assignments = ids.length ? await prisma.shiftAssignment.findMany({ where: { employeeId: { in: ids } }, orderBy: { effectiveFrom: "desc" }, select: { employeeId: true, effectiveFrom: true, effectiveTo: true, shift: { select: { name: true, startTime: true, endTime: true } } } }) : [];
    const byEmployee = new Map<string, typeof assignments>();
    for (const assignment of assignments) { const items = byEmployee.get(assignment.employeeId) || []; items.push(assignment); byEmployee.set(assignment.employeeId, items); }
    const records = rows.map(row => {
      const assignment = byEmployee.get(row.employee.id)?.find(item => item.effectiveFrom <= row.workDate && (!item.effectiveTo || item.effectiveTo >= row.workDate));
      const device = deviceMetadata(row.notes);
      return { id: row.id, workDate: row.workDate, checkIn: row.checkIn, checkOut: row.checkOut, status: row.status, updatedAt: row.updatedAt, employee: row.employee, shift: assignment?.shift ?? null, device, ...attendanceTiming(row, assignment?.shift) };
    });
    const counts = Object.fromEntries(groups.map(item => [item.status, item._count._all]));
    return NextResponse.json({ success: true, records, total, page, pageSize: filters.pageSize, pageCount, branches, stats: { total: groups.reduce((sum, item) => sum + item._count._all, 0), present: (counts.PRESENT || 0) + (counts.REMOTE || 0), late: counts.LATE || 0, absent: counts.ABSENT || 0, missingOut, exceptions: exceptionCount }, lastReceived: latest?.updatedAt ?? null, generatedAt: new Date().toISOString(), canEdit: hr || hasPermission(permissions, { action: "edit", resource: "attendance" }, roles) });
  } catch { return NextResponse.json({ success: false, message: "تعذر تحميل بيانات الحضور. أعد المحاولة." }, { status: 500 }); }
}
