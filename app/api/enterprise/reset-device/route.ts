import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resetEmployeeDevice } from "@/lib/enterprise/device-security";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Device Unbind & Reset Endpoint (`POST /api/enterprise/reset-device`)
 * ----------------------------------------------------------------------
 * Allows HR Managers (`HR_MANAGER`) and Super Admins (`SUPER_ADMIN`) to unbind and reset
 * an employee's mobile device registration (`EmployeeMobileDevice`), enabling login from a new phone.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const roles: string[] = (session.user as any).roles || [];
    const isHrOrAdmin = roles.includes("HR_MANAGER") || roles.includes("SUPER_ADMIN");
    if (!isHrOrAdmin) {
      return NextResponse.json({ success: false, message: "غير مصرح: صلاحية إدارة الموارد البشرية مطلوبة لفك ربط الجهاز" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : typeof body.userId === "string" ? body.userId.trim() : undefined;

    if (!employeeId) {
      return NextResponse.json({ success: false, message: "employeeId is required" }, { status: 400 });
    }

    const success = await resetEmployeeDevice(employeeId);
    if (!success) {
      return NextResponse.json({ success: false, message: "تعذر فك ربط الجهاز أو أن الموظف غير مربوط بجهاز حالياً" }, { status: 404 });
    }

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "device:reset-unbind",
      entity: "EmployeeMobileDevice",
      entityId: employeeId,
      metadata: { employeeId, resetBy: session.user.name || session.user.id }
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "تم فك ربط الجهاز وإعادة التعيين بنجاح" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
