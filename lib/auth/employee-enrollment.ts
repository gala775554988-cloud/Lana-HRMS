import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { normalizeEmployeeEmail } from "@/lib/auth/employee-otp";

type EnrollmentUser = { id: string; loginEmail: string | null };
export function activationToken(code: string) {
  return `employee-email-enrollment:${createHash("sha256").update(code).digest("hex")}`;
}

/** First-mailbox ownership needs either an HR-recorded destination or a private HR activation code. */
export async function resolveEmployeeLoginEmail(
  user: EnrollmentUser,
  recordedEmail: string | null,
  proposedEmail?: string,
  activationCode?: string
) {
  if (user.loginEmail) return normalizeEmployeeEmail(user.loginEmail);
  const email = normalizeEmployeeEmail(proposedEmail ?? "");
  if (!email) return null;
  if (email === normalizeEmployeeEmail(recordedEmail ?? "")) return email;
  if (!activationCode || !/^[a-f0-9]{64}$/.test(activationCode)) return null;
  const invite = await prisma.verificationToken.findUnique({ where: { token: activationToken(activationCode) } });
  return invite?.identifier === `employee-email-enrollment:${user.id}` && invite.expires > new Date() ? email : null;
}

/** Persist only after OTP success; a concurrent admin edit invalidates the enrollment. */
export async function completeEmployeeEmailEnrollment(user: EnrollmentUser, email: string, sessionVersion: number) {
  return prisma.$transaction(async tx => {
    const updated = await tx.user.updateMany({
      where: { id: user.id, loginEmail: user.loginEmail, sessionVersion, isActive: true },
      data: { loginEmail: email, loginEmailVerifiedAt: new Date() },
    });
    if (updated.count !== 1) throw new Error("Account changed during verification");
    await tx.verificationToken.deleteMany({ where: { identifier: `employee-email-enrollment:${user.id}` } });
  });
}
