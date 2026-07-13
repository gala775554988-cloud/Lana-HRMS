import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteAttendanceSite, listAttendanceSites, upsertAttendanceSite } from '@/lib/attendance/sites';
import { writeAuditLog } from '@/lib/audit';

function canManage(session: any) {
  const roles = (session?.user?.roles as string[] | undefined) ?? [];
  const permissions = (session?.user?.permissions as string[] | undefined) ?? [];
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_MANAGER') || permissions.includes('*:*') || permissions.includes('manage:settings') || permissions.includes('manage:attendance');
}

async function requireAccess() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  if (!canManage(session)) throw new Error('Forbidden');
  return session;
}

function status(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === 'Unauthorized') return 401;
  if (msg === 'Forbidden') return 403;
  return 500;
}

export async function GET() {
  try {
    await requireAccess();
    return NextResponse.json({ success: true, sites: await listAttendanceSites() });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: status(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAccess();
    const body = await request.json();
    const site = await upsertAttendanceSite(body);
    await writeAuditLog({ actorUserId: session.user.id, action: body.id ? 'attendance-site:update' : 'attendance-site:create', entity: 'AttendanceSiteSetting', entityId: site.id, metadata: site as any }).catch(() => undefined);
    return NextResponse.json({ success: true, site });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: status(error) });
  }
}

export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAccess();
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
    const site = await deleteAttendanceSite(id);
    await writeAuditLog({ actorUserId: session.user.id, action: 'attendance-site:disable', entity: 'AttendanceSiteSetting', entityId: id }).catch(() => undefined);
    return NextResponse.json({ success: true, site });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: status(error) });
  }
}
