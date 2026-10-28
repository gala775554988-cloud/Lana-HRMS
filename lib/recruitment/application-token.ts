import { createHmac, timingSafeEqual } from "node:crypto";
function secret() { return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""; }
export function applicationToken(now = Date.now()) {
  if (!secret()) return "";
  const issued = String(now);
  return `${issued}.${createHmac("sha256", secret()).update(`career:${issued}`).digest("hex")}`;
}
export function validApplicationToken(token: string, now = Date.now()) {
  const [issued, signature] = token.split(".");
  const age = now - Number(issued);
  if (!secret() || !signature || !/^[a-f0-9]{64}$/.test(signature) || !Number.isFinite(age) || age < 2000 || age > 3600000) return false;
  const expected = applicationToken(Number(issued)).split(".")[1];
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
