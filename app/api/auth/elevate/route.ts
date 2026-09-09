import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assigns the SUPER_ADMIN role to a selected account.
 * This remains an authenticated, SUPER_ADMIN-only administrative operation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const callerRoles = (session.user.roles as string[]) || [];
    if (!callerRoles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetIdentifier = String(body.username || body.identifier || body.nationalId || body.employeeNumber || "").trim();

    let targetUser = null;
    if (targetIdentifier) {
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: targetIdentifier },
            { email: targetIdentifier.toLowerCase() },
            { employeeProfile: { is: { OR: [{ nationalId: targetIdentifier }, { employeeNumber: targetIdentifier }] } } }
          ]
        },
        include: { employeeProfile: true }
      });
    } else if (session?.user?.id) {
      targetUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { employeeProfile: true }
      });
    }

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        message: targetIdentifier
          ? `لم يتم العثور على حساب الموظف أو المستخدم المطابق لـ (${targetIdentifier}). يرجى التحقق من رقم الهوية أو الرقم الوظيفي.`
          : "يرجى تزويدنا باسم المستخدم أو رقم الهوية (identifier)، أو تسجيل الدخول أولاً."
      }, { status: 404 });
    }

    // 1. Ensure SUPER_ADMIN role exists
    const superAdminRole = await prisma.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: { name: "SUPER_ADMIN", description: "Super Administrator with full executive access", isSystem: true }
    });

    // 2. Grant SUPER_ADMIN role to target user
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: targetUser.id, roleId: superAdminRole.id }
    });

    // 3. Audit Log
    await writeAuditLog({
      actorUserId: session?.user?.id || targetUser.id,
      action: "auth:executive_elevation_granted",
      entity: "User",
      entityId: targetUser.id,
      metadata: { targetUsername: targetUser.username, roles: ["SUPER_ADMIN"] }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `تم منح الحساب (${targetUser.name || targetUser.username}) دور مدير النظام بنجاح.`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        email: targetUser.email,
        isSuperAdmin: true
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
