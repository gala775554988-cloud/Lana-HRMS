"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

type ActionState = { success: boolean; message: string };

const BAD_CREDENTIALS = "Invalid username, national ID, password, or account status.";

export async function loginAction(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid login." };
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) return { success: false, message: BAD_CREDENTIALS };
    throw error;
  }

  return { success: true, message: "" };
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
