import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { asNumber, requireEmployee } from '@/lib/employee/portal';

import { z } from 'zod';

const advanceFields = z.object({
  amount: z.union([z.number(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]).transform(Number)
    .pipe(z.number().min(0.01).max(9999999999.99))
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.001),
  reason: z.string().trim().min(3).max(1000),
  installments: z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number)
    .pipe(z.number().int().min(1).max(2147483647)),
  startDate: z.union([z.literal(''), z.string().date()]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

const untouched = { status: 'PENDING_MANAGER', managerStatus: 'PENDING', hrStatus: 'PENDING', financeStatus: 'PENDING' };

function pagination(raw: string | null, fallback: number, max: number) {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

function invalidRequest() {
  return NextResponse.json({ success: false, message: 'راجع المبلغ والسبب وعدد الأقساط وتاريخ البداية' }, { status: 400 });
}

function lockedRequest() {
  return NextResponse.json({ success: false, message: 'تغيرت حالة الطلب أو بدأ اعتماده. حدّث الصفحة.' }, { status: 409 });
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
  paidInstallments: true,
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
  const page = pagination(request.nextUrl.searchParams.get('page'), 1, 1_000_000);
  const pageSize = pagination(request.nextUrl.searchParams.get('pageSize'), 20, 100);
  const where = { employeeId: employee.id };

  // Sequential queries keep production Supabase pool stable and avoid P2024 under load.
  const records = await prisma.employeeSalaryAdvance.findMany({
    where,
    select: advanceSelect,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const total = await prisma.employeeSalaryAdvance.count({ where });

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
  const parsed = advanceFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidRequest();

  const { amount, installments, startDate, ...fields } = parsed.data;
  const monthlyDeduction = Math.round(amount * 100 / installments) / 100;
  if (monthlyDeduction <= 0) return invalidRequest();

  const record = await prisma.$transaction(async tx => {
    const advance = await tx.employeeSalaryAdvance.create({
      data: {
        ...fields, employeeId: employee.id, amount, installments, monthlyDeduction,
        startDate: startDate ? new Date(startDate) : new Date(),
      },
      select: advanceSelect,
    });
    await tx.auditLog.create({ data: {
      actorUserId: session.user.id, action: 'SALARY_ADVANCE_CREATE',
      entity: 'EmployeeSalaryAdvance', entityId: advance.id,
    } });
    if (employee.managerId) {
      const manager = await tx.employee.findUnique({
        where: { id: employee.managerId }, select: { userId: true },
      });
      if (manager?.userId) {
        await tx.notification.create({ data: {
          userId: manager.userId, title: 'طلب سلفة جديد',
          body: 'يوجد طلب سلفة جديد لمراجعته.', type: 'INFO',
        } });
      }
    }
    return advance;
  });
  return NextResponse.json({ success: true, record: serializeAdvance(record) });
}

export async function PUT(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const parsed = advanceFields.partial().extend({ id: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidRequest();
  const { id, startDate, ...fields } = parsed.data;
  if (!Object.keys(fields).length && !startDate) return invalidRequest();

  const where = { id, employeeId: employee.id };
  const existing = await prisma.employeeSalaryAdvance.findFirst({ where });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

  const data = { ...fields, ...(startDate ? { startDate: new Date(startDate) } : {}) };
  if (fields.amount !== undefined || fields.installments !== undefined) {
    const monthlyDeduction = Math.round(Number(fields.amount ?? existing.amount) * 100 / (fields.installments ?? existing.installments)) / 100;
    if (monthlyDeduction <= 0) return invalidRequest();
    Object.assign(data, { monthlyDeduction });
  }

  const record = await prisma.$transaction(async tx => {
    const changed = await tx.employeeSalaryAdvance.updateMany({
      where: { ...where, ...untouched, updatedAt: existing.updatedAt }, data,
    });
    if (changed.count !== 1) return null;
    await tx.auditLog.create({ data: {
      actorUserId: session.user.id, action: 'SALARY_ADVANCE_UPDATE',
      entity: 'EmployeeSalaryAdvance', entityId: id,
    } });
    return tx.employeeSalaryAdvance.findUniqueOrThrow({ where: { id }, select: advanceSelect });
  });
  if (!record) return lockedRequest();
  return NextResponse.json({ success: true, record: serializeAdvance(record) });
}

export async function DELETE(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return invalidRequest();

  const deleted = await prisma.$transaction(async tx => {
    const result = await tx.employeeSalaryAdvance.deleteMany({
      where: { id, employeeId: employee.id, ...untouched },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: {
      actorUserId: session.user.id, action: 'SALARY_ADVANCE_DELETE',
      entity: 'EmployeeSalaryAdvance', entityId: id,
    } });
    return true;
  });
  if (!deleted) return lockedRequest();
  return NextResponse.json({ success: true });
}
