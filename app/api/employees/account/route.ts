import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { normalizeEmployeeEmail } from "@/lib/auth/employee-otp";
import { canManageEmployeeAccounts, canEditEmployeeAccount } from "@/lib/auth/account-management";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  employeeId: z.string().min(1).max(128),
  username: z.string().trim().min(2).max(64).optional(),
  email: z.string().trim().email().max(254).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12, "كلمة المرور يجب أن تتكون من 12 خانة على الأقل.").max(128).optional(),
  restoreIdentityPassword: z.boolean().optional(),
  clearLoginEmail: z.boolean().optional(),
}).strict().refine(data => !(data.password && data.restoreIdentityPassword), "اختر كلمة مرور مخصصة أو آخر أربعة أرقام.")
  .refine(data => !(data.email && data.clearLoginEmail), "لا يمكن تعيين البريد وحذفه في نفس الطلب.");

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  const actorRoles = session.user.roles ?? [];
  if (!canManageEmployeeAccounts(actorRoles)) return NextResponse.json({ success: false, message: "صلاحية مدير النظام أو مدير الموارد البشرية مطلوبة." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 });
  const input = parsed.data;
  const email = input.email ? normalizeEmployeeEmail(input.email) : undefined;
  if (input.email && !email) return NextResponse.json({ success: false, message: "أدخل بريداً حقيقياً قابلاً لاستقبال الرسائل." }, { status: 400 });
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  try {
    await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id: input.employeeId }, include: { user: { include: { roles: { select: { role: { select: { name: true } } } } } } } });
      if (!employee) throw new Error("NOT_FOUND");
      let user = employee.user;
      if (!user) {
        if (!/^\d{4,}$/.test(employee.nationalId)) throw new Error("INVALID_IDENTITY");
        const created = await tx.user.create({ data: {
          username: employee.nationalId,
          email: `emp.${employee.id}@lana.local`,
          name: `${employee.firstName} ${employee.lastName}`,
          passwordHash: await hashPassword(generateTemporaryPassword()),
          isActive: true,
        }, include: { roles: { select: { role: { select: { name: true } } } } } });
        const linked = await tx.employee.updateMany({ where: { id: employee.id, userId: null }, data: { userId: created.id } });
        if (linked.count !== 1) throw new Error("ACCOUNT_CHANGED");
        const role = await tx.role.upsert({ where: { name: "EMPLOYEE" }, update: {}, create: { name: "EMPLOYEE", isSystem: true } });
        await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
        user = created;
      }
      if (!canEditEmployeeAccount(actorRoles, user.roles.map(r => r.role.name), session.user.id, user.id)) throw new Error("FORBIDDEN");
      if (input.restoreIdentityPassword && user.roles.some(r => r.role.name !== "EMPLOYEE")) throw new Error("PRIVILEGED_LOGIN");
      const now = new Date();
      await tx.user.update({ where: { id: user.id }, data: {
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(email ? { loginEmail: email, loginEmailVerifiedAt: null } : {}),
        ...(input.clearLoginEmail ? { loginEmail: null, loginEmailVerifiedAt: null } : {}),
        ...(passwordHash ? { passwordHash, employeePasswordMode: "CUSTOM", mustChangePassword: false, passwordChanged: true, passwordChangedAt: now, lastPasswordResetAt: now, lastPasswordResetBy: session.user.id } : {}),
        ...(input.restoreIdentityPassword ? { employeePasswordMode: "IDENTITY_SUFFIX", mustChangePassword: false, passwordChanged: true, lastPasswordResetAt: now, lastPasswordResetBy: session.user.id } : {}),
        sessionVersion: { increment: 1 },
      } });
      // Clear stale OTPs and older invitations after every sensitive account edit.
      await tx.verificationToken.deleteMany({ where: { OR: [
        { token: `employee-email-login:${user.id}:pending` },
        { identifier: `employee-email-enrollment:${user.id}` },
      ] } });
      await tx.auditLog.create({ data: {
        actorUserId: session.user.id, action: "employee:account_updated", entity: "user", entityId: user.id,
        metadata: { employeeId: employee.id, fields: Object.keys(input).filter(key => key !== "employeeId") },
      } });
    });
    return NextResponse.json({ success: true, message: "تم تحديث الحساب وإلغاء جلساته السابقة." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const reason = error instanceof Error ? error.message : "";
    const status = reason === "FORBIDDEN" ? 403 : reason === "NOT_FOUND" ? 404 : code === "P2002" || ["ACCOUNT_CHANGED", "EMAIL_ALREADY_SAVED"].includes(reason) ? 409 : ["INVALID_IDENTITY", "PRIVILEGED_LOGIN"].includes(reason) ? 400 : 500;
    const message = code === "P2002" ? "اسم المستخدم أو بريد الدخول مستخدم بالفعل." : reason === "EMAIL_ALREADY_SAVED" ? "احذف بريد الدخول الحالي أولاً لإعادة تسجيل البريد." : reason === "FORBIDDEN" ? "لا يمكنك تعديل هذا الحساب." : reason === "PRIVILEGED_LOGIN" ? "الحساب الإداري يحتفظ بكلمة مروره ولا يستخدم آخر أربعة أرقام." : reason === "NOT_FOUND" ? "الموظف غير موجود." : "تعذر تحديث الحساب.";
    return NextResponse.json({ success: false, message }, { status });
  }
}
