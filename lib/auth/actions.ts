"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut, findUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { verifyOrBindEmployeeDevice } from "@/lib/cache/device-cache";
import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

type ActionState = { success: boolean; message: string };

const BAD_CREDENTIALS = "بيانات الدخول غير صحيحة (تأكد من رقم الهوية أو كلمة المرور أو حالة ارتباط الجهاز).";

export async function loginAction(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "بيانات الدخول غير صحيحة." };
  }

  try {
    const { identifier, password, deviceId } = parsed.data;

    // 1. Pre-verify identity & password with exact error diagnostics
    const user = await findUser(identifier);
    if (!user) {
      return {
        success: false,
        message: "بيانات الدخول غير صحيحة: لم يتم العثور على حساب أو موظف مطابق لرقم الهوية أو اسم المستخدم المرفق."
      };
    }
    if (!user.isActive) {
      return {
        success: false,
        message: "حساب الموظف غير مفعل حالياً. يرجى مراجعة إدارة الموارد البشرية لتفعيل الحساب."
      };
    }
    if (!user.passwordHash) {
      return {
        success: false,
        message: "بيانات الدخول غير صحيحة: لا توجد كلمة مرور معينة للحساب، يرجى مراجعة إدارة الموارد البشرية."
      };
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return {
        success: false,
        message: "بيانات الدخول غير صحيحة: كلمة المرور المدخلة غير مطابقة لحسابك."
      };
    }

    // 2. Device Binding Pre-check (Strict Policy & Freeze on mismatch)
    if (deviceId && deviceId !== "unknown" && deviceId !== "server-side" && deviceId !== "mobile-session-fallback") {
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { userId: user.id },
            { nationalId: user.username || "" },
            { employeeNumber: user.username || "" }
          ]
        },
        select: { id: true }
      });

      if (employee) {
        const deviceCheck = await verifyOrBindEmployeeDevice(employee.id, deviceId, "mobile");
        if (!deviceCheck.allowed) {
          return {
            success: false,
            message: deviceCheck.reason || "حسابك مرتبط بجهاز آخر. يرجى مراجعة الموارد البشرية لإعادة التعيين."
          };
        }
      }
    }

    await signIn("credentials", {
      identifier,
      password,
      deviceId,
      redirect: false,
    });
    return { success: true, message: "" };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, message: BAD_CREDENTIALS };
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(input: unknown): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid account identifier." };
  }
  return { success: true, message: "If the account exists, HR administrators can issue a secure password reset token." };
}

export async function resetPasswordAction(input: unknown): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid password reset request." };
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash }, include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { success: false, message: "Password reset link is invalid or expired." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return { success: true, message: "Password has been reset. You can sign in now." };
}

export async function verifyEmailAction(input: unknown): Promise<ActionState> {
  const parsed = emailVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid verification request." };
  }

  const t = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) {
    return { success: false, message: "Verification link is invalid or expired." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: t.userId }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
  ]);

  return { success: true, message: "Account verified. You can sign in now." };
}
