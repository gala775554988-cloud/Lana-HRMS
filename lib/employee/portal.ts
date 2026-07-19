import { cache } from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { memoryCache } from '@/lib/cache/memory-cache';
import { getEffectiveLeaveBalance } from '@/lib/employee/leave-balance';

function isPoolTimeout(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Timed out fetching a new connection') || message.includes('P2024');
}

export async function dbQuery<T>(label: string, fn: () => Promise<T>, fallback?: T): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isPoolTimeout(error) || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  console.error('[EmployeePortal][DB_QUERY_FAILED]', { label, error: lastError instanceof Error ? lastError.message : String(lastError) });
  if (fallback !== undefined) return fallback;
  throw lastError;
}

export const requireEmployee = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const employee = await dbQuery('requireEmployee.employee.findFirst', () => prisma.employee.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      nationalId: true,
      email: true,
      phone: true,
      profilePhotoUrl: true,
      sponsor: true,
      status: true,
      departmentId: true,
      positionId: true,
      branchId: true,
      managerId: true,
      dateOfBirth: true,
      nationalityId: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
      branch: { select: { name: true } },
      manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, email: true } },
      user: { select: { id: true, username: true, email: true, isActive: true, lastLoginAt: true, mustChangePassword: true, passwordChangedAt: true } },
    },
  }));
  if (!employee) {
    const roles: string[] = (session.user as any).roles || [];
    if (roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || session.user.name?.toLowerCase().includes("admin") || (session.user as any).username?.toLowerCase().includes("admin")) {
      return {
        session,
        employee: {
          id: session.user.id,
          userId: session.user.id,
          firstName: session.user.name || "المدير",
          lastName: "المسؤول",
          employeeNumber: "ADMIN-001",
          nationalId: "1000000001",
          email: session.user.email || "admin@lana.local",
          phone: "0500000000",
          profilePhotoUrl: null,
          sponsor: "Lana HRMS",
          status: "ACTIVE",
          departmentId: null,
          positionId: null,
          branchId: null,
          managerId: null,
          dateOfBirth: null,
          nationalityId: null,
          department: { name: "الإدارة العامة" },
          position: { title: "مسؤول النظام" },
          branch: { name: "الفرع الرئيسي" },
          manager: null,
          user: { id: session.user.id, username: "admin", email: session.user.email || "admin@lana.local", isActive: true, lastLoginAt: new Date(), mustChangePassword: false, passwordChangedAt: new Date() }
        } as any
      };
    }
    throw new Error('Employee profile is not linked to this account');
  }
  return { session, employee };
});

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
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  return memoryCache(`employee-dashboard:${employeeId}:${userId ?? 'nouser'}:${todayKey}`, 20_000, () => getPortalDashboardUncached(employeeId, userId));
}

async function getPortalDashboardUncached(employeeId: string, userId?: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Sequential + Prisma select only. Production pool is small; parallel fan-out can cause P2024.
  const attendanceToday = await dbQuery<any | null>('dashboard.attendance.today', () => prisma.attendanceRecord.findFirst({ where: { employeeId, workDate: { gte: today } }, select: { status: true, workDate: true, checkIn: true, checkOut: true }, orderBy: { workDate: 'desc' } }), null);
  const attendanceMonth = await dbQuery<any[]>('dashboard.attendance.month', () => prisma.attendanceRecord.findMany({ where: { employeeId, workDate: { gte: monthStart, lt: nextMonth } }, select: { status: true, checkIn: true, checkOut: true, workDate: true }, orderBy: { workDate: 'asc' } }), []);
  const leaves = await dbQuery<any[]>('dashboard.leave', () => prisma.leaveRequest.findMany({ where: { employeeId }, select: { status: true, days: true, reason: true, createdAt: true, leaveType: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }), []);
  const permissionRequests = await dbQuery<any[]>('dashboard.permission', () => (prisma as any).employeePermissionRequest?.findMany?.({ where: { employeeId }, select: { reason: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }) ?? Promise.resolve([]), []);
  const payroll = await dbQuery<any | null>('dashboard.payroll', () => prisma.payrollItem.findFirst({ where: { employeeId }, select: { baseSalary: true, netPay: true, currency: true, createdAt: true }, orderBy: { createdAt: 'desc' } }), null);
  const documents = await dbQuery<number>('dashboard.documents', () => prisma.employeeDocument.count({ where: { employeeId } }), 0);
  const assets = await dbQuery<number>('dashboard.assets', () => prisma.asset.count({ where: { assignedEmployeeId: employeeId } }), 0);
  const notifications = await dbQuery<any[]>('dashboard.notifications', () => prisma.notification.findMany({ where: { OR: [{ userId }, { userId: null }], readAt: null }, select: { title: true, type: true, createdAt: true }, take: 10, orderBy: { createdAt: 'desc' } }), []);
  const portalTaskCount = await dbQuery<number>('dashboard.tasks.count', () => (prisma as any).employeePortalTask?.count?.({ where: { employeeId, status: { not: 'COMPLETED' } } }) ?? Promise.resolve(0), 0);

  const empRawRecord = await dbQuery<any | null>('dashboard.employee.raw', () => prisma.employee.findUnique({ where: { id: employeeId }, select: { odooRawData: true } }), null);
  const raw = empRawRecord?.odooRawData as any || {};
  const csv = raw._csvLeaveData || {};

  const leaveBalance = await dbQuery('dashboard.leaveBalance', () => getEffectiveLeaveBalance(employeeId), { accrued: 30, used: 0, remaining: 30 });
  const leaveEntitlement = leaveBalance.accrued;
  const leaveUsed = leaveBalance.used;
  // Intentionally not clamped to zero -- a real overdraft (approved past the
  // employee's balance) must render as a negative number, not silently hide.
  const leaveRemaining = leaveBalance.remaining;
  const leaveMonthsAccrued = Number(csv.monthsAccrued ?? raw.leaveMonthsAccrued ?? 0);

  const monthHours = attendanceMonth.reduce((sum: number, r: any) => r.checkIn && r.checkOut ? sum + Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / 36e5) : sum, 0);
  const presentDays = attendanceMonth.filter((r: any) => ['PRESENT','LATE','REMOTE'].includes(r.status)).length;
  const latestAttendance = attendanceMonth.at(-1);
  const latestLeave = leaves[0];
  const timeline = [
    latestLeave && { type: 'طلب', title: `آخر طلب إجازة: ${latestLeave.leaveType?.name ?? latestLeave.reason ?? 'إجازة'}`, date: latestLeave.createdAt, status: latestLeave.status },
    permissionRequests[0] && { type: 'استئذان', title: `آخر استئذان: ${permissionRequests[0].reason}`, date: permissionRequests[0].createdAt, status: permissionRequests[0].status },
    notifications[0] && { type: 'إشعار', title: notifications[0].title, date: notifications[0].createdAt, status: notifications[0].type },
    latestAttendance && { type: 'حضور', title: `آخر حضور: ${latestAttendance.status}`, date: latestAttendance.workDate, status: latestAttendance.checkOut ? 'مكتمل' : 'مفتوح' },
  ].filter(Boolean) as Array<{type:string;title:string;date:Date;status:string}>;
  return { attendanceToday, attendanceMonth, leaves, permissionRequests, payroll, documents, assets, notifications, leaveUsed, leaveRemaining, leaveEntitlement, leaveMonthsAccrued, monthHours, presentDays, timeline, taskCount: portalTaskCount };
}

export function profileCompletion(employee: any) {
  const checks = [employee.profilePhotoUrl, employee.firstName, employee.lastName, employee.nationalId, employee.phone, employee.email, employee.departmentId, employee.positionId, employee.branchId, employee.managerId, employee.dateOfBirth, employee.nationalityId];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function serializeRows(rows: any[]) { return rows.map(row => ({ ...row, from: row.fromDate?.toISOString?.().slice(0,10), to: row.toDate?.toISOString?.().slice(0,10) })); }

export async function getEmployeeSetting<T = unknown>(employeeId: string, section: string, fallback: T): Promise<T> {
  const db = prisma as any;
  if (section === 'bank') {
    const row = await dbQuery<any | null>('portal.employeeBankAccount.findFirst', () => db.employeeBankAccount?.findFirst?.({ where: { employeeId, isPrimary: true } }) ?? Promise.resolve(null), null);
    return (row ? { bank: row.bank, iban: row.iban, account: row.account } : fallback) as T;
  }
  if (section === 'family') {
    const rows = await dbQuery<any[]>('portal.employeeFamilyMember.findMany', () => db.employeeFamilyMember?.findMany?.({ where: { employeeId }, orderBy: { createdAt: 'asc' } }) ?? Promise.resolve([]), []);
    return { members: rows, spouse: rows.find((r:any)=>r.relation==='spouse')?.name ?? '', children: String(rows.filter((r:any)=>r.relation==='child').length || ''), emergency: rows.find((r:any)=>r.isEmergencyContact)?.phone ?? '' } as T;
  }
  const map: Record<string,string> = { qualifications:'employeeQualification', experiences:'employeeExperience', skills:'employeeSkill', languages:'employeeLanguage', permissionRequests:'employeePermissionRequest', tasks:'employeePortalTask' };
  if (map[section]) {
    const rows = await dbQuery<any[]>(`portal.${map[section]}.findMany`, () => db[map[section]]?.findMany?.({ where: { employeeId }, orderBy: { createdAt: 'desc' }, include: section === 'tasks' ? { comments: true, attachments: true } : undefined }) ?? Promise.resolve([]), []);
    return serializeRows(rows) as T;
  }
  if (section === 'chat') {
    const threads = await dbQuery<any[]>('portal.employeeChatThread.findMany', () => db.employeeChatThread?.findMany?.({ where: { employeeId }, include: { messages: { orderBy: { createdAt: 'desc' } } }, orderBy: { updatedAt: 'desc' } }) ?? Promise.resolve([]), []);
    return threads.flatMap((t:any)=>t.messages.map((m:any)=>({ id:m.id, to:t.participantType, text:m.body, fileName:m.fileName, createdAt:m.createdAt }))) as T;
  }
  return fallback;
}

export async function setEmployeeSetting(employeeId: string, section: string, value: unknown, userId?: string) {
  const db = prisma as any;
  if (section === 'bank') {
    const data = value as any;
    const existing = await db.employeeBankAccount.findFirst({ where: { employeeId, isPrimary: true } });
    return existing ? db.employeeBankAccount.update({ where: { id: existing.id }, data: { bank: data.bank || 'غير محدد', iban: data.iban || 'غير محدد', account: data.account || null } }) : db.employeeBankAccount.create({ data: { employeeId, bank: data.bank || 'غير محدد', iban: data.iban || 'غير محدد', account: data.account || null } });
  }
  if (section === 'family') {
    const data = value as any;
    await db.employeeFamilyMember.deleteMany({ where: { employeeId } });
    const creates = [];
    if (data.spouse) creates.push({ employeeId, relation: 'spouse', name: data.spouse });
    const count = Number(data.children || 0); for (let i=0;i<count;i++) creates.push({ employeeId, relation: 'child', name: `ابن/ابنة ${i+1}` });
    if (data.emergency) creates.push({ employeeId, relation: 'emergency', name: 'جهة اتصال طوارئ', phone: data.emergency, isEmergencyContact: true });
    if (creates.length) await db.employeeFamilyMember.createMany({ data: creates });
    return true;
  }
  const rows = Array.isArray(value) ? value : [];
  if (['qualifications','experiences','skills','languages'].includes(section)) {
    const modelMap: Record<string,string> = { qualifications:'employeeQualification', experiences:'employeeExperience', skills:'employeeSkill', languages:'employeeLanguage' };
    const model = db[modelMap[section]];
    await model.deleteMany({ where: { employeeId } });
    for (const row of rows) {
      if (section === 'qualifications') await model.create({ data: { employeeId, title: row.title || 'غير محدد', organization: row.org || row.organization || null, field: row.field || null, fromDate: row.from ? new Date(row.from) : null, toDate: row.to ? new Date(row.to) : null, notes: row.notes || null } });
      if (section === 'experiences') await model.create({ data: { employeeId, title: row.title || 'غير محدد', organization: row.org || row.organization || null, fromDate: row.from ? new Date(row.from) : null, toDate: row.to ? new Date(row.to) : null, notes: row.notes || null } });
      if (section === 'skills') await model.create({ data: { employeeId, name: row.title || row.name || 'مهارة', level: Number(row.level || 1), notes: row.notes || null } });
      if (section === 'languages') await model.create({ data: { employeeId, name: row.title || row.name || 'لغة', level: row.level || row.org || 'BASIC', notes: row.notes || null } });
    }
    return true;
  }
  if (section === 'permissionRequests') {
    await db.employeePermissionRequest.deleteMany({ where: { employeeId } });
    for (const row of rows) await db.employeePermissionRequest.create({ data: { employeeId, requestDate: row.date ? new Date(row.date) : new Date(), fromTime: row.from || '00:00', toTime: row.to || '00:00', reason: row.reason || 'استئذان', status: row.status || 'PENDING_MANAGER', workflow: row.workflow || ['Employee'] } });
    return true;
  }
  if (section === 'tasks') {
    await db.employeePortalTask.deleteMany({ where: { employeeId, source: 'employee' } });
    for (const row of rows.filter((r:any)=>r.source==='employee')) {
      const task = await db.employeePortalTask.create({ data: { employeeId, title: row.title || 'مهمة', status: row.status || 'PENDING', progress: Number(row.progress || 0), source: 'employee' } });
      for (const c of row.comments || []) await db.employeePortalTaskComment.create({ data: { taskId: task.id, authorUserId: userId, body: c } });
      for (const a of row.attachments || []) await db.employeePortalTaskAttachment.create({ data: { taskId: task.id, fileName: a, fileUrl: a } });
    }
    return true;
  }
  if (section === 'chat') {
    const messages = rows;
    for (const row of messages.slice(0,1)) {
      const thread = await db.employeeChatThread.upsert({ where: { id: row.threadId || row.id }, update: { updatedAt: new Date() }, create: { id: row.threadId || row.id, employeeId, participantType: row.to || 'Manager', subject: 'Employee chat' } }).catch(async()=> db.employeeChatThread.create({ data: { employeeId, participantType: row.to || 'Manager', subject: 'Employee chat' } }));
      await db.employeeChatMessage.create({ data: { threadId: thread.id, senderUserId: userId, body: row.text || '', fileName: row.fileName || null, fileUrl: row.fileName || null } });
    }
    return true;
  }
  return true;
}
