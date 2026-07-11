import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEmployee } from '@/lib/employee/portal';
import { writeAuditLog } from '@/lib/audit';

function statusFromStages(managerStatus: string, hrStatus: string, financeStatus: string) {
  if ([managerStatus, hrStatus, financeStatus].includes('REJECTED')) return 'REJECTED';
  if (financeStatus === 'APPROVED') return 'APPROVED';
  if (hrStatus === 'APPROVED') return 'PENDING_FINANCE';
  if (managerStatus === 'APPROVED') return 'PENDING_HR';
  return 'PENDING_MANAGER';
}

export async function GET(request: NextRequest) {
  const { employee } = await requireEmployee();
  const page = Math.max(Number(request.nextUrl.searchParams.get('page') ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') ?? 20), 5), 100);
  const where = { employeeId: employee.id };
  const [records, total] = await Promise.all([
    (prisma as any).employeeSalaryAdvance.findMany({ where, select: { id: true, amount: true, reason: true, installments: true, monthlyDeduction: true, startDate: true, status: true, managerStatus: true, hrStatus: true, financeStatus: true, managerComment: true, hrComment: true, financeComment: true, attachments: true, notes: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    (prisma as any).employeeSalaryAdvance.count({ where })
  ]);
  return NextResponse.json({ success: true, records, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  const amount = Number(body.amount);
  const installments = Math.max(Number(body.installments ?? 1), 1);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ success: false, message: 'قيمة السلفة غير صحيحة' }, { status: 400 });
  const monthlyDeduction = amount / installments;
  const record = await (prisma as any).employeeSalaryAdvance.create({ data: { employeeId: employee.id, amount, reason: String(body.reason || 'طلب سلفة'), installments, monthlyDeduction, startDate: body.startDate ? new Date(body.startDate) : new Date(), attachments: body.attachments ?? [], notes: body.notes || null } });
  await prisma.notification.createMany({ data: [
    { userId: employee.manager?.id ? null : null, title: 'طلب سلفة جديد', body: `${employee.firstName} ${employee.lastName} قدم طلب سلفة`, type: 'INFO' },
    { userId: null, title: 'طلب سلفة بانتظار الاعتماد', body: 'يرجى مراجعة طلبات السلف في الموارد البشرية والمالية', type: 'INFO' }
  ]}).catch(() => undefined);
  await writeAuditLog({ actorUserId: session.user.id, action: 'SALARY_ADVANCE_CREATE', entity: 'EmployeeSalaryAdvance', entityId: record.id, metadata: { employeeId: employee.id, amount, workflow: ['Employee', 'Manager Approval', 'HR Approval', 'Finance Approval'] } }).catch(() => undefined);
  return NextResponse.json({ success: true, record });
}

export async function PUT(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
  const existing = await (prisma as any).employeeSalaryAdvance.findFirst({ where: { id: body.id, employeeId: employee.id } });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  const data: any = {};
  if (existing.status === 'PENDING_MANAGER') {
    if (body.amount) data.amount = Number(body.amount);
    if (body.reason) data.reason = String(body.reason);
    if (body.installments) data.installments = Number(body.installments);
    if (body.startDate) data.startDate = new Date(body.startDate);
    if (body.notes !== undefined) data.notes = body.notes;
    if (data.amount || data.installments) data.monthlyDeduction = Number(data.amount ?? existing.amount) / Number(data.installments ?? existing.installments);
  }
  if (body.managerStatus || body.hrStatus || body.financeStatus) {
    if (body.managerStatus) data.managerStatus = body.managerStatus;
    if (body.hrStatus) data.hrStatus = body.hrStatus;
    if (body.financeStatus) data.financeStatus = body.financeStatus;
    data.status = statusFromStages(data.managerStatus ?? existing.managerStatus, data.hrStatus ?? existing.hrStatus, data.financeStatus ?? existing.financeStatus);
  }
  const record = await (prisma as any).employeeSalaryAdvance.update({ where: { id: body.id }, data });
  await writeAuditLog({ actorUserId: session.user.id, action: 'SALARY_ADVANCE_UPDATE', entity: 'EmployeeSalaryAdvance', entityId: record.id, metadata: data }).catch(() => undefined);
  return NextResponse.json({ success: true, record });
}

export async function DELETE(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
  const existing = await (prisma as any).employeeSalaryAdvance.findFirst({ where: { id, employeeId: employee.id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  if (existing.status !== 'PENDING_MANAGER') return NextResponse.json({ success: false, message: 'لا يمكن حذف طلب بدأ اعتماده' }, { status: 409 });
  await (prisma as any).employeeSalaryAdvance.delete({ where: { id } });
  await writeAuditLog({ actorUserId: session.user.id, action: 'SALARY_ADVANCE_DELETE', entity: 'EmployeeSalaryAdvance', entityId: id }).catch(() => undefined);
  return NextResponse.json({ success: true });
}
