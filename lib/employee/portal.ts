import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function requireEmployee() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    include: {
      department: true,
      position: true,
      branch: true,
      employmentType: true,
      nationality: true,
      manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, email: true } },
      user: { select: { id: true, username: true, email: true, isActive: true, lastLoginAt: true, mustChangePassword: true, passwordChangedAt: true } },
    },
  });
  if (!employee) throw new Error('Employee profile is not linked to this account');
  return { session, employee };
}

export function asNumber(value: unknown) {
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') return (value as { toNumber: () => number }).toNumber();
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function fmtDate(value: unknown, locale = 'ar-SA') {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale);
}

export async function getPortalDashboard(employeeId: string, userId?: string) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const [attendanceToday, attendanceMonth, leaves, payroll, documents, assets, notifications, latestDoc, latestAttendance, latestLeave, latestAudit] = await Promise.all([
    prisma.attendanceRecord.findFirst({ where: { employeeId, workDate: { gte: today } }, orderBy: { workDate: 'desc' } }),
    prisma.attendanceRecord.findMany({ where: { employeeId, workDate: { gte: monthStart, lt: nextMonth } }, orderBy: { workDate: 'asc' } }),
    prisma.leaveRequest.findMany({ where: { employeeId }, include: { leaveType: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.payrollItem.findFirst({ where: { employeeId }, include: { payrollRun: true }, orderBy: { createdAt: 'desc' } }).catch(() => null),
    prisma.employeeDocument.count({ where: { employeeId } }),
    prisma.asset.count({ where: { assignedEmployeeId: employeeId } }),
    prisma.notification.findMany({ where: { OR: [{ userId }, { userId: null }], readAt: null }, take: 10, orderBy: { createdAt: 'desc' } }),
    prisma.employeeDocument.findFirst({ where: { employeeId }, orderBy: { uploadedAt: 'desc' } }),
    prisma.attendanceRecord.findFirst({ where: { employeeId }, orderBy: { workDate: 'desc' } }),
    prisma.leaveRequest.findFirst({ where: { employeeId }, include: { leaveType: true }, orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findFirst({ where: { OR: [{ entityId: employeeId }, { metadata: { path: ['employeeId'], equals: employeeId } }] as any }, orderBy: { createdAt: 'desc' } }).catch(() => null),
  ]);
  const leaveUsed = leaves.filter(l => l.status === 'APPROVED').reduce((s,l)=>s+asNumber(l.days),0);
  const monthHours = attendanceMonth.reduce((sum, r) => {
    if (r.checkIn && r.checkOut) return sum + Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / 36e5);
    return sum;
  }, 0);
  const presentDays = attendanceMonth.filter(r => ['PRESENT','LATE','REMOTE'].includes(r.status)).length;
  const timeline = [
    latestLeave && { type: 'طلب', title: `آخر طلب إجازة: ${latestLeave.leaveType?.name ?? latestLeave.reason ?? 'إجازة'}`, date: latestLeave.createdAt, status: latestLeave.status },
    latestAudit && { type: 'موافقة/نشاط', title: `${latestAudit.action} - ${latestAudit.entity}`, date: latestAudit.createdAt, status: 'مسجل' },
    notifications[0] && { type: 'إشعار', title: notifications[0].title, date: notifications[0].createdAt, status: notifications[0].type },
    latestAttendance && { type: 'حضور', title: `آخر حضور: ${latestAttendance.status}`, date: latestAttendance.workDate, status: latestAttendance.checkOut ? 'مكتمل' : 'مفتوح' },
    latestDoc && { type: 'مستند', title: `تم رفع: ${latestDoc.name}`, date: latestDoc.uploadedAt, status: latestDoc.status },
  ].filter(Boolean) as Array<{type:string;title:string;date:Date;status:string}>;
  return { attendanceToday, attendanceMonth, leaves, payroll, documents, assets, notifications, leaveUsed, leaveRemaining: Math.max(30 - leaveUsed, 0), monthHours, presentDays, timeline };
}

export function profileCompletion(employee: any) {
  const checks = [employee.profilePhotoUrl, employee.firstName, employee.lastName, employee.nationalId, employee.phone, employee.email, employee.departmentId, employee.positionId, employee.branchId, employee.managerId, employee.dateOfBirth, employee.nationalityId];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function getEmployeeSetting<T = unknown>(employeeId: string, section: string, fallback: T): Promise<T> {
  const setting = await prisma.appSetting.findUnique({ where: { key: `employee.portal.${employeeId}.${section}` }, select: { value: true } }).catch(() => null);
  return (setting?.value as T) ?? fallback;
}

export async function setEmployeeSetting(employeeId: string, section: string, value: unknown) {
  return prisma.appSetting.upsert({
    where: { key: `employee.portal.${employeeId}.${section}` },
    update: { value: value as any },
    create: { key: `employee.portal.${employeeId}.${section}`, value: value as any, description: `Employee portal ${section}` },
  });
}
