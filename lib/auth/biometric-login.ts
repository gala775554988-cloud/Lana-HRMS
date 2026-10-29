import { headers } from "next/headers";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";

async function relyingParty() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost";
  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || `${process.env.NODE_ENV === "production" ? "https" : "http"}://${host}`;
  const url = new URL(origin);
  return { origin: url.origin, rpID: url.hostname.replace(/^www\./, "") };
}

export async function prepareBiometricLogin(userId: string) {
  const credentials = await prisma.biometricCredential.findMany({ where: { userId } });
  if (!credentials.length) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  if (!user) return null;
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map(credential => ({ id: Buffer.from(credential.credentialID, "base64url"), type: "public-key" as const })),
    userVerification: "required",
  });
  await prisma.user.update({ where: { id: userId }, data: { currentChallenge: JSON.stringify({ purpose: "login", sessionVersion: user.sessionVersion, challenge: options.challenge, expires: Date.now() + 120000 }) } });
  return options;
}

export async function verifyBiometricLogin(userId: string, serializedResponse: string) {
  try {
    const response = JSON.parse(serializedResponse) as AuthenticationResponseJSON;
    const credential = await prisma.biometricCredential.findUnique({ where: { credentialID: response.id }, include: { user: true } });
    if (!credential || credential.userId !== userId || !credential.user.isActive || !credential.user.currentChallenge) return false;
    const savedChallenge = credential.user.currentChallenge;
    const pending = JSON.parse(savedChallenge);
    if (pending.purpose !== "login" || pending.sessionVersion !== credential.user.sessionVersion || pending.expires <= Date.now()) return false;
    const { origin, rpID } = await relyingParty();
    const result = await verifyAuthenticationResponse({
      response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      authenticator: { credentialID: Buffer.from(credential.credentialID, "base64url"), credentialPublicKey: new Uint8Array(credential.publicKey), counter: Number(credential.counter) },
    });
    if (!result.verified) return false;
    return await prisma.$transaction(async tx => {
      const consumed = await tx.user.updateMany({ where: { id: userId, isActive: true, sessionVersion: credential.user.sessionVersion, currentChallenge: savedChallenge }, data: { currentChallenge: null } });
      if (consumed.count !== 1) return false;
      await tx.biometricCredential.update({ where: { id: credential.id }, data: { counter: BigInt(result.authenticationInfo.newCounter), lastUsedAt: new Date() } });
      return true;
    });
  } catch {
    return false;
  }
}
