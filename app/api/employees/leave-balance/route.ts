import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { setEmployeeLeaveBalance, getAvailableLeaveBalance } from "@/lib/employee/leave-balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, accrued, used, monthsAccrued } = body;
    const accruedNumber = Number(accrued);
    const usedNumber = Number(used);
    const monthsNumber = monthsAccrued === undefined ? undefined : Number(monthsAccrued);

    if (!employeeId || typeof employeeId !== "string") {
      return NextResponse.json({ success: false, message: "employeeId required" }, { status: 400 });
    }
    if (!Number.isFinite(accruedNumber) || accruedNumber < 0 || !Number.isFinite(usedNumber) || usedNumber < 0 || (monthsNumber !== undefined && (!Number.isFinite(monthsNumber) || monthsNumber < 0))) {
      return NextResponse.json({ success: false, message: "قيم رصيد الإجازة غير صالحة" }, { status: 400 });
    }

    await setEmployeeLeaveBalance(employeeId, {
      accrued: accruedNumber,
      used: usedNumber,
      monthsAccrued: monthsNumber,
    });
    const balance = await getAvailableLeaveBalance(employeeId);

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "leave-balance:update",
      entity: "employee",
      entityId: employeeId,
      metadata: { accrued: accruedNumber, used: usedNumber, remaining: accruedNumber - usedNumber, monthsAccrued: monthsNumber }
    });

    return NextResponse.json({ success: true, message: "تم تحديث رصيد الإجازات بنجاح", data: balance });
  } catch (error) {
    console.error("[leave-balance] error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
