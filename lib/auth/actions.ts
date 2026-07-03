'use server';

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { addMinutes, createSecureToken, hashToken } from "@/lib/tokens";
import { sendTransactionalEmail } from "@/lib/mail";
import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema
} from "@/lib/validations/auth";

type ActionState = {
  success: boolean;
  message: string;
};

const genericResetMessage =
  "If an account exists for that email, password reset instructions have been sent.";

function getAppUrl() {
  return process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function loginAction(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid login." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false
    });

    return { success: true, message: "Signed in successfully." };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, message: "Invalid email, password, or account status." };
    }

    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(input: unknown): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid email." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user?.isActive) {
    return { success: true, message: genericResetMessage };
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  const token = createSecureToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: addMinutes(new Date(), 30)
    }
  });

  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
  await sendTransactionalEmail({
    to: user.email,
    subject: "Reset your HRMS password",
    text: `Use this secure link to reset your password: ${resetUrl}`
  });

  return { success: true, message: genericResetMessage };
}

export async function resetPasswordAction(input: unknown): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid password reset request." };
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { success: false, message: "Password reset link is invalid or expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    })
  ]);

  return { success: true, message: "Password has been reset. You can sign in now." };
}

export async function verifyEmailAction(input: unknown): Promise<ActionState> {
  const parsed = emailVerificationSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid verification request." };
  }

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) }
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
    return { success: false, message: "Verification link is invalid or expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: new Date() }
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() }
    })
  ]);

  return { success: true, message: "Email verified. You can sign in now." };
}

