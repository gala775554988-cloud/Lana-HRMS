import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidateMultiDeviceOverrideCache } from "@/lib/cache/device-cache";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_CONFIRMATION = "UNBIND_ALL_DEVICES";

/**
 * Clears every mobile-device binding so each employee can bind a device again
 * at their next successful login. This is deliberately SUPER_ADMIN-only and
 * requires an explicit confirmation value because it affects every account.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user.roles as string[] | undefined) ?? [];
    if (!roles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح: صلاحية Super Admin مطلوبة لفك ارتباط جميع الأجهزة" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
    if (body.confirmation !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        { success: false, message: "يلزم تأكيد العملية قبل فك ارتباط جميع الأجهزة" },
        { status: 400 }
      );
    }

    const result = await prisma.employeeMobileDevice.deleteMany({});
    // Clears the in-process cache immediately. Restart/redeploy after this
    // operation so any other warm application instances discard their cache.
    invalidateMultiDeviceOverrideCache();

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "device:reset-all-unbind",
      entity: "EmployeeMobileDevice",
      metadata: {
        deletedCount: result.count,
        resetBy: session.user.name || session.user.id,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `تم فك ارتباط ${result.count} جهاز/أجهزة بنجاح. يمكن للموظفين تسجيل الدخول وربط أجهزتهم من جديد.`,
      restartRecommended: true,
    });
  } catch (error) {
    console.error("[reset-all-devices]", error);
    return NextResponse.json({ success: false, message: "تعذر فك ارتباط الأجهزة. راجع سجل الخادم." }, { status: 500 });
  }
}
