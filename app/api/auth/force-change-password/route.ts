import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ success: false, message: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, message: "كلمة المرور الجديدة وتأكيدها غير متطابقين" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }

    // Strong password validation
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword);
    
    if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      return NextResponse.json({ 
        success: false, 
        message: "كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز" 
      }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ success: false, message: "المستخدم غير موجود" }, { status: 404 });
    }

    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentValid) {
      return NextResponse.json({ success: false, message: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ success: false, message: "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية" }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChanged: true,
        passwordChangedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: user.id,
      metadata: { forced: true, timestamp: new Date().toISOString() },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("[force-change-password] error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
