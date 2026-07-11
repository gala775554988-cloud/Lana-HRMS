import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEmployee } from '@/lib/employee/portal';
import { writeAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const { employee } = await requireEmployee();
  const page = Math.max(Number(request.nextUrl.searchParams.get('page') ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') ?? 20), 5), 100);
  const where = { employeeId: employee.id };
  const [records, total] = await Promise.all([
    (prisma as any).employeeComplaint.findMany({ where, select: { id: true, type: true, category: true, title: true, description: true, priority: true, status: true, anonymous: true, assignedTo: true, resolution: true, attachments: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    (prisma as any).employeeComplaint.count({ where })
  ]);
  return NextResponse.json({ success: true, records, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  if (!body.title || !body.description) return NextResponse.json({ success: false, message: 'العنوان والوصف مطلوبان' }, { status: 400 });
  const record = await (prisma as any).employeeComplaint.create({ data: { employeeId: employee.id, type: body.type || 'Complaint', category: body.category || 'Other', title: body.title, description: body.description, priority: body.priority || 'Medium', anonymous: Boolean(body.anonymous), attachments: body.attachments ?? [], status: 'OPEN' } });
  await prisma.notification.create({ data: { userId: null, title: `${record.type === 'Complaint' ? 'شكوى' : 'اقتراح'} جديد`, body: record.title, type: record.priority === 'Critical' ? 'ERROR' : 'INFO' } }).catch(() => undefined);
  await writeAuditLog({ actorUserId: session.user.id, action: 'COMPLAINT_CREATE', entity: 'EmployeeComplaint', entityId: record.id, metadata: { employeeId: employee.id, type: record.type, category: record.category, workflow: ['Employee', 'HR', 'Manager if needed', 'Closed'] } }).catch(() => undefined);
  return NextResponse.json({ success: true, record });
}

export async function PUT(request: NextRequest) {
  const { employee, session } = await requireEmployee();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
  const existing = await (prisma as any).employeeComplaint.findFirst({ where: { id: body.id, employeeId: employee.id } });
  if (!existing) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  const data: any = {};
  for (const key of ['type','category','title','description','priority','status','anonymous','assignedTo','resolution','attachments']) if (body[key] !== undefined) data[key] = body[key];
  const record = await (prisma as any).employeeComplaint.update({ where: { id: body.id }, data });
  await writeAuditLog({ actorUserId: session.user.id, action: 'COMPLAINT_UPDATE', entity: 'EmployeeComplaint', entityId: record.id, metadata: data }).catch(() => undefined);
  return NextResponse.json({ success: true, record });
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
