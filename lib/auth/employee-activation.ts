import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function activationPinIdentifier(userId: string) {
  return `employee-activation-pin:${userId}`;
}
export function activationPinToken(userId: string, pin: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Authentication is unavailable");
  return `${activationPinIdentifier(userId)}:${createHmac("sha256", secret).update(`${userId}:${pin}`).digest("hex")}`;
}

/** Four-digit HR-issued credential. Attempts and resets are serialized in the DB,
 * including across Vercel instances. Never store or log the plaintext PIN. */
export async function verifyEmployeeActivation(user: { id: string; sessionVersion: number }, pin: string) {
  if (!/^\d{4}$/.test(pin)) return false;
  const token = activationPinToken(user.id, pin);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${activationPinIdentifier(user.id)}))`;
    const current = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, sessionVersion: true } });
    if (!current?.isActive || current.sessionVersion !== user.sessionVersion) return false;
    const now = new Date();
    const attemptToken = `employee-activation-attempts:${user.id}`;
    const attempts = await tx.verificationToken.findUnique({ where: { token: attemptToken } });
    const failures = attempts && attempts.expires > now ? Number(attempts.identifier) || 0 : 0;
    if (failures >= 5) return false;
    const credential = await tx.verificationToken.findUnique({ where: { token } });
    if (credential?.identifier === activationPinIdentifier(user.id) && credential.expires > now) {
      await tx.verificationToken.deleteMany({ where: { token: attemptToken } });
      return true;
    }
    const expires = failures === 0 || failures === 4 ? new Date(now.getTime() + 15 * 60 * 1000) : attempts!.expires;
    await tx.verificationToken.upsert({ where: { token: attemptToken }, create: { token: attemptToken, identifier: String(failures + 1), expires }, update: { identifier: String(failures + 1), expires } });
    return false;
  });
}
