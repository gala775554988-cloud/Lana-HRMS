"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut, findUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { checkLoginPassword } from "@/lib/auth/employee-login";
import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

import { prepareBiometricLogin } from "@/lib/auth/biometric-login";

type ActionState = { success: boolean; message: string; requiresActivation?: boolean; biometricOptions?: Awaited<ReturnType<typeof prepareBiometricLogin>>; enrollBiometric?: boolean };

const BAD_CREDENTIALS = "بيانات الدخول أو رمز التفعيل غير صحيحة. بعد ٥ محاولات خاطئة انتظر ١٥ دقيقة أو راجع المسؤول.";

export async function loginAction(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? BAD_CREDENTIALS };
  try {
    const { identifier, password, activationCode, biometricResponse } = parsed.data;
    const user = await findUser(identifier);
    if (!user?.isActive) return { success: false, message: BAD_CREDENTIALS };
    const { valid, employee } = await checkLoginPassword(user, password);
    if (!valid) return { success: false, message: BAD_CREDENTIALS };
    if (employee && !activationCode && !biometricResponse) {
      const biometricOptions = await prepareBiometricLogin(user.id);
      if (biometricOptions) return { success: false, message: "أكد الدخول ببصمة الجهاز", biometricOptions };
    }
    if (employee && !activationCode && !biometricResponse) return { success: false, requiresActivation: true, message: "أدخل رمز التفعيل المكون من ٤ أرقام الذي استلمته من المسؤول. لا يلزم بريد إلكتروني." };
    // Auth.js serializes these options with URLSearchParams. Omit absent
    // fields: undefined becomes the literal "undefined" and fails validation.
    await signIn("credentials", {
      identifier,
      password,
      ...(biometricResponse ? { biometricResponse } : {}),
      ...(activationCode ? { activationCode } : {}),
      redirect: false,
    });
    return { success: true, message: "", enrollBiometric: Boolean(employee && !biometricResponse) };
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
