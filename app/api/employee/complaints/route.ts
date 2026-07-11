import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEmployee } from '@/lib/employee/portal';
import { writeAuditLog } from '@/lib/audit';

const TYPES = new Set(['Complaint', 'Suggestion']);
const CATEGORIES = new Set(['HR', 'Manager', 'Payroll', 'Attendance', 'IT', 'Administration', 'Other']);
const PRIORITIES = new Set(['Low', 'Medium', 'High', 'Critical']);
const STATUSES = new Set(['OPEN', 'IN_REVIEW', 'WAITING_MANAGER', 'RESOLVED', 'CLOSED', 'REJECTED']);

const complaintSelect = {
  id: true,
  type: true,
  category: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  anonymous: true,
  assignedTo: true,
  resolution: true,
  attachments: true,
  createdAt: true,
  updatedAt: true,
};

function serializeComplaint(record: any) {
  return {
    ...record,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const { employee } = await requireEmployee();
  const page = Math.max(Number(request.nextUrl.searchParams.get('page') ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') ?? 20), 5), 100);
  const where = { employeeId: employee.id };

  // Sequential Prisma calls avoid exhausting the small serverless pool.
  const records = await (prisma as any).employeeComplaint.findMany({
    where,
    select: complaintSelect,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const total = await (prisma as any).employeeComplaint.count({ where });

  return NextResponse.json({
    success: true,
    records: records.map(serializeComplaint),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  if (!body.title || !body.description) return NextResponse.json({ success: false, message: 'العنوان والوصف مطلوبان' }, { status: 400 });

  const type = TYPES.has(body.type) ? body.type : 'Complaint';
  const category = CATEGORIES.has(body.category) ? body.category : 'Other';
  const priority = PRIORITIES.has(body.priority) ? body.priority : 'Medium';

  const record = await (prisma as any).employeeComplaint.create({
    data: {
      employeeId: employee.id,
      type,
      category,
      title: String(body.title).trim(),
      description: String(body.description).trim(),
      priority,
      anonymous: Boolean(body.anonymous),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      status: 'OPEN',
    },
    select: complaintSelect,
  });

  await prisma.notification
    .create({
      data: {
        userId: null,
        title: `${record.type === 'Complaint' ? 'شكوى' : 'اقتراح'} جديد`,
        body: `${record.title} - Workflow: Employee → HR → Manager إذا لزم → Closed`,
        type: record.priority === 'Critical' ? 'ERROR' : 'INFO',
      },
    })
    .catch(() => undefined);
  await writeAuditLog({
    actorUserId: session.user.id,
    action: 'COMPLAINT_CREATE',
    entity: 'EmployeeComplaint',
    entityId: record.id,
    metadata: { employeeId: employee.id, type: record.type, category: record.category, workflow: ['Employee', 'HR', 'Manager if needed', 'Closed'] },
  }).catch(() => undefined);

  return NextResponse.json({ success: true, record: serializeComplaint(record) });
}

export async function PUT(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });

  const existing = await (prisma as any).employeeComplaint.findFirst({ where: { id: body.id, employeeId: employee.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

  const data: any = {};
  if (body.type !== undefined && TYPES.has(body.type)) data.type = body.type;
  if (body.category !== undefined && CATEGORIES.has(body.category)) data.category = body.category;
  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.priority !== undefined && PRIORITIES.has(body.priority)) data.priority = body.priority;
  if (body.status !== undefined && STATUSES.has(body.status)) data.status = body.status;
  if (body.anonymous !== undefined) data.anonymous = Boolean(body.anonymous);
  if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo ? String(body.assignedTo) : null;
  if (body.resolution !== undefined) data.resolution = body.resolution ? String(body.resolution) : null;
  if (body.attachments !== undefined) data.attachments = Array.isArray(body.attachments) ? body.attachments : [];

  const record = await (prisma as any).employeeComplaint.update({ where: { id: body.id }, data, select: complaintSelect });
  await writeAuditLog({ actorUserId: session.user.id, action: 'COMPLAINT_UPDATE', entity: 'EmployeeComplaint', entityId: record.id, metadata: data }).catch(() => undefined);
  return NextResponse.json({ success: true, record: serializeComplaint(record) });
}

export async function DELETE(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });

  const existing = await (prisma as any).employeeComplaint.findFirst({ where: { id, employeeId: employee.id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  if (existing.status === 'CLOSED') return NextResponse.json({ success: false, message: 'لا يمكن حذف طلب مغلق' }, { status: 409 });

  await (prisma as any).employeeComplaint.delete({ where: { id } });
  await writeAuditLog({ actorUserId: session.user.id, action: 'COMPLAINT_DELETE', entity: 'EmployeeComplaint', entityId: id }).catch(() => undefined);
  return NextResponse.json({ success: true });
}
