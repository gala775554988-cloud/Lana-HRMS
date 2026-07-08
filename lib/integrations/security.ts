import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_SECRET = "lana-hrms-development-integration-secret-change-me";

function key() {
  return crypto.createHash("sha256").update(process.env.INTEGRATION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SECRET).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(cipherText?: string | null) {
  if (!cipherText) return "";
  const [ivRaw, tagRaw, encryptedRaw] = cipherText.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
}

export function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createApiKey(prefix = "lana") {
  return `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;
}

export function signWebhook(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = signWebhook(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function createOAuthClientSecret() {
  return crypto.randomBytes(40).toString("base64url");
}
