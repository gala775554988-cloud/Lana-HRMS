import { timingSafeEqual } from "node:crypto";

export function hasValidInternalSyncToken(request?: Request | null): boolean {
  if (!request) return false;
  const expected = (process.env.ATTENDANCE_BRIDGE_TOKEN || process.env.INTERNAL_SYNC_TOKEN || "").trim();
  const header = request.headers.get("authorization") || request.headers.get("x-internal-sync-token") || "";
  const supplied = (header.startsWith("Bearer ") ? header.slice(7) : header).trim();
  if (!expected || !supplied) return false;

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
