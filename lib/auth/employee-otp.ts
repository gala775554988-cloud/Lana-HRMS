import { prisma } from "@/lib/prisma";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const TTL = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const OTP_UNAVAILABLE = "التحقق بالبريد غير متاح حالياً. يرجى مراجعة الموارد البشرية للتأكد من البريد المسجل وإعداد خدمة إرسال البريد.";

export function normalizeEmployeeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const domain = email.split("@")[1];
  if (/\.(local|invalid|test)$/.test(domain) || /(^|\.)example\.(com|org|net)$/.test(domain)) return null;
  return email;
}

function signingKey() {
  const key = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!key) throw new Error(OTP_UNAVAILABLE);
  return key;
}

function digest(userId: string, email: string, nonce: string, code: string) {
  return createHmac("sha256", signingKey()).update(JSON.stringify([userId, email, nonce, code])).digest("hex");
}

function destinationHash(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

function isDuplicate(error: unknown) {
  return (error as { code?: string })?.code === "P2002";
}

/** Durable, atomic rate-limit claims shared across instances. */
async function claimSendBudget(userId: string, now: Date) {
  const identifier = `employee-email-login:${userId}`;
  await prisma.verificationToken.deleteMany({ where: { identifier, expires: { lte: now } } });
  const minute = Math.floor(now.getTime() / 60000);
  const window = Math.floor(now.getTime() / 600000);
  try {
    await prisma.verificationToken.create({ data: { identifier, token: `${identifier}:send:${minute}`, expires: new Date((minute + 1) * 60000) } });
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    throw new Error("انتظر دقيقة قبل طلب رمز جديد.");
  }
  for (let slot = 0; slot < 5; slot++) {
    try {
      await prisma.verificationToken.create({ data: { identifier, token: `${identifier}:budget:${window}:${slot}`, expires: new Date((window + 1) * 600000) } });
      return;
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  throw new Error("تجاوزت عدد المحاولات المسموح. حاول لاحقاً.");
}

/** Uses Resend's HTTPS API; no SMS subscription or browser/device binding. */
export async function sendEmployeeOtp(userId: string, destination: string) {
  const email = normalizeEmployeeEmail(destination);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OTP_EMAIL_FROM;
  if (!email || !apiKey || !from || /[\r\n]/.test(from)) throw new Error(OTP_UNAVAILABLE);
  signingKey();
  await claimSendBudget(userId, new Date());
  const code = randomInt(0, 1000000).toString().padStart(6, "0");
  const nonce = randomBytes(16).toString("hex");
  const identifier = JSON.stringify({ digest: digest(userId, email, nonce, code), destination: destinationHash(email), nonce });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "رمز الدخول إلى Lana HRMS",
      text: `رمز التحقق لتسجيل الدخول هو: ${code}\nالرمز صالح لمدة خمس دقائق ولمرة واحدة فقط.\nلا تشارك الرمز مع أي شخص. إذا لم تطلب تسجيل الدخول، تجاهل هذه الرسالة.`,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(OTP_UNAVAILABLE);
  const sent = await response.json() as { id?: string };
  if (!sent.id) throw new Error(OTP_UNAVAILABLE);
  // Store only a keyed digest: never persist or log the six-digit code.
  const token = `employee-email-login:${userId}:pending`;
  await prisma.verificationToken.upsert({
    where: { token },
    create: { identifier, token, expires: new Date(Date.now() + TTL) },
    update: { identifier, expires: new Date(Date.now() + TTL) },
  });
}

/** Enforced inside Credentials.authorize, including direct Auth.js requests. */
export async function verifyEmployeeOtp(userId: string, code: string, destination: string) {
  const email = normalizeEmployeeEmail(destination);
  if (!email || !/^\d{6}$/.test(code)) return false;
  const token = `employee-email-login:${userId}:pending`;
  const pending = await prisma.verificationToken.findUnique({ where: { token } });
  if (!pending || pending.expires <= new Date()) return false;
  let challenge: { digest: string; destination: string; nonce: string };
  try {
    challenge = JSON.parse(pending.identifier);
    if (!/^[a-f0-9]{64}$/.test(challenge.digest) || !/^[a-f0-9]{32}$/.test(challenge.nonce) || challenge.destination !== destinationHash(email)) return false;
  } catch {
    return false;
  }
  const identifier = `employee-email-login:${userId}`;
  let claimed = false;
  for (let slot = 0; slot < MAX_ATTEMPTS; slot++) {
    try {
      await prisma.verificationToken.create({ data: { identifier, token: `${identifier}:attempt:${challenge.nonce}:${slot}`, expires: pending.expires } });
      claimed = true;
      break;
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  if (!claimed) return false;
  const actual = Buffer.from(digest(userId, email, challenge.nonce, code), "hex");
  if (!timingSafeEqual(actual, Buffer.from(challenge.digest, "hex"))) return false;
  const consumed = await prisma.verificationToken.deleteMany({ where: { token, identifier: pending.identifier, expires: { gt: new Date() } } });
  return consumed.count === 1;
}
