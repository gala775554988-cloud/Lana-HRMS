import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { asNumber, requireEmployee } from '@/lib/employee/portal';
import { writeAuditLog } from '@/lib/audit';

const STAGE_STATUS = new Set(['PENDING', 'APPROVED', 'REJECTED']);

function statusFromStages(managerStatus: string, hrStatus: string, financeStatus: string) {
  if ([managerStatus, hrStatus, financeStatus].includes('REJECTED')) return 'REJECTED';
  if (financeStatus === 'APPROVED') return 'APPROVED';
  if (hrStatus === 'APPROVED') return 'PENDING_FINANCE';
  if (managerStatus === 'APPROVED') return 'PENDING_HR';
  return 'PENDING_MANAGER';
}

function serializeAdvance(record: any) {
  return {
    ...record,
    amount: asNumber(record.amount),
    monthlyDeduction: asNumber(record.monthlyDeduction),
    startDate: record.startDate?.toISOString?.() ?? record.startDate,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
  };
}

const advanceSelect = {
  id: true,
  amount: true,
  reason: true,
  installments: true,
  monthlyDeduction: true,
  startDate: true,
  status: true,
  managerStatus: true,
  hrStatus: true,
  financeStatus: true,
  managerComment: true,
  hrComment: true,
  financeComment: true,
  attachments: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(request: NextRequest) {
  const { employee } = await requireEmployee();
  const page = Math.max(Number(request.nextUrl.searchParams.get('page') ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') ?? 20), 5), 100);
  const where = { employeeId: employee.id };

  // Sequential queries keep production Supabase pool stable and avoid P2024 under load.
  const records = await (prisma as any).employeeSalaryAdvance.findMany({
    where,
    select: advanceSelect,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const total = await (prisma as any).employeeSalaryAdvance.count({ where });

  return NextResponse.json({
    success: true,
    records: records.map(serializeAdvance),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  const amount = Number(body.amount);
  const installments = Math.max(Number(body.installments ?? 1), 1);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ success: false, message: 'قيمة السلفة غير صحيحة' }, { status: 400 });
  }
  if (!body.reason || String(body.reason).trim().length < 3) {
    return NextResponse.json({ success: false, message: 'سبب السلفة مطلوب' }, { status: 400 });
  }

  const monthlyDeduction = amount / installments;
  const record = await (prisma as any).employeeSalaryAdvance.create({
    data: {
      employeeId: employee.id,
      amount,
      reason: String(body.reason).trim(),
      installments,
      monthlyDeduction,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      notes: body.notes ? String(body.notes) : null,
    },
    select: advanceSelect,
  });

  await prisma.notification
    .createMany({
      data: [
        { userId: null, title: 'طلب سلفة جديد', body: `${employee.firstName} ${employee.lastName} قدم طلب سلفة بانتظار موافقة المدير`, type: 'INFO' },
        { userId: null, title: 'مسار اعتماد السلفة', body: 'Employee → Manager Approval → HR Approval → Finance Approval', type: 'INFO' },
      ],
    })
    .catch(() => undefined);
  await writeAuditLog({
    actorUserId: session.user.id,
    action: 'SALARY_ADVANCE_CREATE',
    entity: 'EmployeeSalaryAdvance',
    entityId: record.id,
    metadata: { employeeId: employee.id, amount, workflow: ['Employee', 'Manager Approval', 'HR Approval', 'Finance Approval'] },
  }).catch(() => undefined);

  return NextResponse.json({ success: true, record: serializeAdvance(record) });
}

export async function PUT(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });

  const existing = await (prisma as any).employeeSalaryAdvance.findFirst({ where: { id: body.id, employeeId: employee.id } });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

  const data: any = {};
  if (existing.status === 'PENDING_MANAGER') {
    if (body.amount !== undefined) data.amount = Number(body.amount);
    if (body.reason !== undefined) data.reason = String(body.reason).trim();
    if (body.installments !== undefined) data.installments = Math.max(Number(body.installments), 1);
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
    if (body.attachments !== undefined) data.attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (data.amount !== undefined || data.installments !== undefined) {
      data.monthlyDeduction = Number(data.amount ?? existing.amount) / Number(data.installments ?? existing.installments);
    }
  }

  for (const stage of ['managerStatus', 'hrStatus', 'financeStatus'] as const) {
    if (body[stage] !== undefined && STAGE_STATUS.has(body[stage])) data[stage] = body[stage];
  }
  for (const comment of ['managerComment', 'hrComment', 'financeComment'] as const) {
    if (body[comment] !== undefined) data[comment] = body[comment] ? String(body[comment]) : null;
  }
  if (data.managerStatus || data.hrStatus || data.financeStatus) {
    data.status = statusFromStages(
      data.managerStatus ?? existing.managerStatus,
      data.hrStatus ?? existing.hrStatus,
      data.financeStatus ?? existing.financeStatus
    );
  }

  const record = await (prisma as any).employeeSalaryAdvance.update({ where: { id: body.id }, data, select: advanceSelect });
  await writeAuditLog({ actorUserId: session.user.id, action: 'SALARY_ADVANCE_UPDATE', entity: 'EmployeeSalaryAdvance', entityId: record.id, metadata: data }).catch(() => undefined);
  return NextResponse.json({ success: true, record: serializeAdvance(record) });
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
