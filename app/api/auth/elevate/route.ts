import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLanaDelegateIds, setLanaDelegateIds } from "@/lib/enterprise/lana-delegates";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct Backend Override & Executive Elevation (`SUPER_ADMIN + 👑` Delegate Injection)
 * Elevates the targeted user (by username, nationalId, employeeNumber, or active session) to SUPER_ADMIN
 * and adds them to the Executive Delegates list (`enterprise.lanaDelegates`).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // This route is listed in middleware.ts's PUBLIC_API_PREFIXES under
    // "/api/auth/" with the note "(session-checked internally)" -- it never
    // actually was. Anyone, unauthenticated, could previously POST a
    // username/nationalId/employeeNumber here and be granted SUPER_ADMIN
    // plus Lana AI executive delegate status. Two authorized paths now:
    // (1) an existing SUPER_ADMIN elevating someone else by identifier, or
    // (2) a BOOTSTRAP_ADMIN_SECRET bearer token (a Vercel env var that must
    // be deliberately set -- absent by default, so this path is inert until
    // someone with Vercel dashboard access opts in) paired with the caller's
    // own active session, self-elevating only that same account -- never an
    // arbitrary third party -- so a leaked secret alone can't hijack
    // someone else's account.
    const bootstrapSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
    const authHeader = request.headers.get("authorization") || "";
    const isBootstrapCall = Boolean(bootstrapSecret) && authHeader === `Bearer ${bootstrapSecret}`;

    if (!isBootstrapCall) {
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      }
      const callerRoles = (session.user.roles as string[]) || [];
      if (!callerRoles.includes("SUPER_ADMIN")) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const targetIdentifier = String(body.username || body.identifier || body.nationalId || body.employeeNumber || "").trim();

    let targetUser = null;
    if (isBootstrapCall) {
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "You must be logged in (any account) for the bootstrap secret to self-elevate that account." }, { status: 401 });
      }
      targetUser = await prisma.user.findUnique({
        where: { id: session.user.id }
      });
    } else if (targetIdentifier) {
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: targetIdentifier },
            { email: targetIdentifier.toLowerCase() },
            { employee: { OR: [{ nationalId: targetIdentifier }, { employeeNumber: targetIdentifier }] } }
          ]
        },
        include: { employee: true }
      });
    } else if (session?.user?.id) {
      targetUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { employee: true }
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

    // 3. Add to Lana AI Delegates list (👑 Crown Badge & Executive Authority Protocol)
    const currentDelegates = await getLanaDelegateIds();
    if (!currentDelegates.includes(targetUser.id)) {
      await setLanaDelegateIds(session?.user?.id || targetUser.id, [...currentDelegates, targetUser.id]);
    }

    // 4. Audit Log
    await writeAuditLog({
      actorUserId: session?.user?.id || targetUser.id,
      action: "auth:executive_elevation_granted",
      entity: "User",
      entityId: targetUser.id,
      metadata: { targetUsername: targetUser.username, roles: ["SUPER_ADMIN"], delegate: true, viaBootstrapSecret: isBootstrapCall }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `تم رفع صلاحية الحساب (${targetUser.name || targetUser.username}) بنجاح إلى SUPER_ADMIN وربطه بالتاج التنفيذي (👑). يمكنك الآن تشغيل المزامنة الشاملة بدون أي قيود صلاحية.`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        email: targetUser.email,
        isSuperAdmin: true,
        isDelegate: true,
        badge: "👑"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
