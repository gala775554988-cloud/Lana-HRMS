import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { SENSITIVE_EMPLOYEE_FIELDS, getEmployeeFieldAccessRaw, setEmployeeFieldAccess, type EmployeeFieldAccessMap } from "@/lib/enterprise/employee-field-access";
import { canManagePermissionAdministration } from "@/lib/enterprise/permissions-admin";

function canManage(session: any) {
  return canManagePermissionAdministration(session?.user?.roles, session?.user?.permissions);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const targetUserId = request.nextUrl.searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });

  const access = await getEmployeeFieldAccessRaw(targetUserId);
  return NextResponse.json({ success: true, fields: SENSITIVE_EMPLOYEE_FIELDS, access });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { targetUserId?: string; access?: Partial<EmployeeFieldAccessMap> };
  if (!body.targetUserId) return NextResponse.json({ success: false, message: "targetUserId is required" }, { status: 400 });

  const saved = await setEmployeeFieldAccess(session.user.id, body.targetUserId, body.access ?? {});
  return NextResponse.json({ success: true, access: saved });
}
