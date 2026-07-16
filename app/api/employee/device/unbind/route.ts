import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { unbindEmployeeDevice } from "@/lib/cache/device-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reset / unbind mobile device for an employee (purges SQL and memory/Redis cache).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  let targetEmployeeId = body.employeeId;

  // If not HR_MANAGER/SUPER_ADMIN, employee can only unbind their own device if allowed or via HR
  const isHrOrAdmin = hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"]);
  if (!isHrOrAdmin) {
    if (targetEmployeeId && targetEmployeeId !== session.user.id) {
      return NextResponse.json({ success: false, message: "Forbidden: Only HR admins can unbind other employees' devices" }, { status: 403 });
    }
    const emp = await prisma.employee.findFirst({ where: { userId: session.user.id } });
    if (!emp) return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    targetEmployeeId = emp.id;
  }

  if (!targetEmployeeId) {
    return NextResponse.json({ success: false, message: "employeeId required" }, { status: 400 });
  }

  const success = await unbindEmployeeDevice(targetEmployeeId);
  return NextResponse.json({ success, message: success ? "تم فك ارتباط جهاز الجوال بنجاح" : "تعذر فك ارتباط الجهاز" });
}
