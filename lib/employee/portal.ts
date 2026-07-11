import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

export async function requireEmployee() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const employee = await dbQuery('requireEmployee.employee.findFirst', () => prisma.employee.findFirst({
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
  }));
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
  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Sequential + retry. Production pool is small; Promise.all caused P2024 and made all employee pages crash.
  const attendanceToday = await dbQuery('dashboard.attendanceRecord.findFirst.today', () => prisma.attendanceRecord.findFirst({ where: { employeeId, workDate: { gte: today } }, orderBy: { workDate: 'desc' } }), null);
  const attendanceMonth = await dbQuery('dashboard.attendanceRecord.findMany.month', () => prisma.attendanceRecord.findMany({ where: { employeeId, workDate: { gte: monthStart, lt: nextMonth } }, orderBy: { workDate: 'asc' } }), []);
  const leaves = await dbQuery('dashboard.leaveRequest.findMany', () => prisma.leaveRequest.findMany({ where: { employeeId }, include: { leaveType: true }, orderBy: { createdAt: 'desc' }, take: 20 }), []);
  const permissionRequests = await dbQuery<any[]>('dashboard.employeePermissionRequest.findMany', () => (prisma as any).employeePermissionRequest?.findMany?.({ where: { employeeId }, orderBy: { createdAt: 'desc' }, take: 20 }) ?? Promise.resolve([]), []);
  const payroll = await dbQuery('dashboard.payrollItem.findFirst', () => prisma.payrollItem.findFirst({ where: { employeeId }, include: { payrollRun: true }, orderBy: { createdAt: 'desc' } }), null);
  const documents = await dbQuery('dashboard.employeeDocument.count', () => prisma.employeeDocument.count({ where: { employeeId } }), 0);
  const assets = await dbQuery('dashboard.asset.count', () => prisma.asset.count({ where: { assignedEmployeeId: employeeId } }), 0);
  const notifications = await dbQuery('dashboard.notification.findMany', () => prisma.notification.findMany({ where: { OR: [{ userId }, { userId: null }], readAt: null }, take: 10, orderBy: { createdAt: 'desc' } }), []);
  const latestDoc = await dbQuery('dashboard.employeeDocument.findFirst', () => prisma.employeeDocument.findFirst({ where: { employeeId }, orderBy: { uploadedAt: 'desc' } }), null);
  const latestAttendance = await dbQuery('dashboard.attendanceRecord.findFirst.latest', () => prisma.attendanceRecord.findFirst({ where: { employeeId }, orderBy: { workDate: 'desc' } }), null);
  const latestLeave = await dbQuery('dashboard.leaveRequest.findFirst', () => prisma.leaveRequest.findFirst({ where: { employeeId }, include: { leaveType: true }, orderBy: { createdAt: 'desc' } }), null);
  const latestAudit = await dbQuery('dashboard.auditLog.findFirst', () => prisma.auditLog.findFirst({ where: { OR: [{ entityId: employeeId }, { metadata: { path: ['employeeId'], equals: employeeId } }] as any }, orderBy: { createdAt: 'desc' } }), null);
  const portalTasks = await dbQuery<any[]>('dashboard.employeePortalTask.findMany', () => (prisma as any).employeePortalTask?.findMany?.({ where: { employeeId, status: { not: 'COMPLETED' } }, take: 20 }) ?? Promise.resolve([]), []);

  const leaveUsed = leaves.filter(l => l.status === 'APPROVED').reduce((s,l)=>s+asNumber(l.days),0);
  const monthHours = attendanceMonth.reduce((sum, r) => r.checkIn && r.checkOut ? sum + Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / 36e5) : sum, 0);
  const presentDays = attendanceMonth.filter(r => ['PRESENT','LATE','REMOTE'].includes(r.status)).length;
  const timeline = [
    latestLeave && { type: 'طلب', title: `آخر طلب إجازة: ${latestLeave.leaveType?.name ?? latestLeave.reason ?? 'إجازة'}`, date: latestLeave.createdAt, status: latestLeave.status },
    permissionRequests[0] && { type: 'استئذان', title: `آخر استئذان: ${permissionRequests[0].reason}`, date: permissionRequests[0].createdAt, status: permissionRequests[0].status },
    latestAudit && { type: 'موافقة/نشاط', title: `${latestAudit.action} - ${latestAudit.entity}`, date: latestAudit.createdAt, status: 'مسجل' },
    notifications[0] && { type: 'إشعار', title: notifications[0].title, date: notifications[0].createdAt, status: notifications[0].type },
    latestAttendance && { type: 'حضور', title: `آخر حضور: ${latestAttendance.status}`, date: latestAttendance.workDate, status: latestAttendance.checkOut ? 'مكتمل' : 'مفتوح' },
    latestDoc && { type: 'مستند', title: `تم رفع: ${latestDoc.name}`, date: latestDoc.uploadedAt, status: latestDoc.status },
  ].filter(Boolean) as Array<{type:string;title:string;date:Date;status:string}>;
  return { attendanceToday, attendanceMonth, leaves, permissionRequests, payroll, documents, assets, notifications, leaveUsed, leaveRemaining: Math.max(30 - leaveUsed, 0), monthHours, presentDays, timeline, taskCount: portalTasks.length };
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
