"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut, findUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { resolveEmployeeLoginEmail } from "@/lib/auth/employee-enrollment";
import { checkLoginPassword } from "@/lib/auth/employee-login";
import { sendEmployeeOtp, OTP_UNAVAILABLE } from "@/lib/auth/employee-otp";
import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

type ActionState = { success: boolean; message: string; requiresOtp?: boolean; requiresEmail?: boolean };

const BAD_CREDENTIALS = "بيانات الدخول أو رمز التحقق غير صحيحة.";

export async function loginAction(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? BAD_CREDENTIALS };
  try {
    const { identifier, password, verificationCode, enrollmentEmail, activationCode } = parsed.data;
    const user = await findUser(identifier);
    if (!user?.isActive) return { success: false, message: BAD_CREDENTIALS };
    const { valid, employee } = await checkLoginPassword(user, password);
    if (!valid) return { success: false, message: BAD_CREDENTIALS };
    if (employee && !verificationCode) {
      if (!user.loginEmail && !enrollmentEmail) return { success: false, requiresEmail: true, message: "أدخل بريدك الإلكتروني لأول مرة. إذا كان مختلفاً عن البريد المسجل لدى الموارد البشرية، أدخل رمز التفعيل الذي تحصل عليه من المسؤول." };
      const email = await resolveEmployeeLoginEmail(user, employee.email, enrollmentEmail, activationCode);
      if (!email) return { success: false, requiresEmail: !user.loginEmail, message: "تعذر اعتماد البريد. استخدم البريد المسجل لدى الموارد البشرية أو رمز تفعيل صالحاً من المسؤول." };
      try {
        await sendEmployeeOtp(user.id, email);
      } catch (error) {
        const message = error instanceof Error && [OTP_UNAVAILABLE, "انتظر دقيقة قبل طلب رمز جديد.", "تجاوزت عدد المحاولات المسموح. حاول لاحقاً."].includes(error.message) ? error.message : OTP_UNAVAILABLE;
        return { success: false, message };
      }
      return { success: false, requiresOtp: true, message: "أُرسل رمز التحقق إلى بريدك الإلكتروني. الرمز صالح لمدة خمس دقائق." };
    }
    await signIn("credentials", { identifier, password, verificationCode, enrollmentEmail, activationCode, redirect: false });
    return { success: true, message: "" };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, message: BAD_CREDENTIALS };
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
