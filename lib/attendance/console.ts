import type { AttendanceStatus, Prisma } from "@prisma/client";

export const ATTENDANCE_STATUS: Record<string, string> = { PRESENT: "حاضر", ABSENT: "غائب", LATE: "متأخر", HALF_DAY: "يوم جزئي", REMOTE: "عن بُعد", HOLIDAY: "عطلة" };
export type AttendanceFilters = { search: string; from: string; to: string; status: string; branch: string; device: string; view: string; mode: "attendance" | "biometrics"; page: number; pageSize: number };
export function readAttendanceFilters(params: URLSearchParams): AttendanceFilters {
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  for (const date of [from, to]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("تحقق من تاريخ الفترة المحددة");
  if (from && to && from > to) throw new Error("تاريخ البداية يجب أن يسبق تاريخ النهاية");
  const integer = (key: string, fallback: number, max: number) => { const number = Number(params.get(key) || fallback); return Number.isInteger(number) && number > 0 ? Math.min(number, max) : fallback; };
  const status = params.get("status") || "";
  if (status && !ATTENDANCE_STATUS[status]) throw new Error("حالة حضور غير صحيحة");
  return { search: (params.get("search") || "").trim().slice(0, 200), from, to, status, branch: params.get("branch") || "", device: (params.get("device") || "").slice(0, 200), view: params.get("view") === "exceptions" ? "exceptions" : "records", mode: params.get("mode") === "biometrics" ? "biometrics" : "attendance", page: integer("page", 1, 100000), pageSize: integer("pageSize", 25, 100) };
}
export function attendanceWhere(filters: AttendanceFilters, scoped: Prisma.AttendanceRecordWhereInput): Prisma.AttendanceRecordWhereInput {
  const and: Prisma.AttendanceRecordWhereInput[] = [scoped];
  if (filters.from || filters.to) and.push({ workDate: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lt: new Date(Date.parse(filters.to) + 86400000) } : {}) } });
  if (filters.search) and.push({ employee: { OR: [ { firstName: { contains: filters.search, mode: "insensitive" } }, { lastName: { contains: filters.search, mode: "insensitive" } }, { employeeNumber: { contains: filters.search, mode: "insensitive" } }, { AND: filters.search.split(/\s+/).map(word => ({ OR: [{firstName:{contains:word,mode:"insensitive" as const}},{lastName:{contains:word,mode:"insensitive" as const}}] })) } ] } });
  if (filters.branch) and.push({ employee: { branchId: filters.branch } });
  if (filters.status) and.push({ status: filters.status as AttendanceStatus });
  if (filters.mode === "biometrics") and.push({ notes: { contains: '"source"' } });
  if (filters.device) and.push({ notes: { contains: filters.device, mode: "insensitive" } });
  return { AND: and };
}
export function attendanceExceptions(today: string): Prisma.AttendanceRecordWhereInput {
  return { OR: [{ status: { in: ["ABSENT", "LATE", "HALF_DAY"] } }, { status: { notIn: ["HOLIDAY", "ABSENT"] }, workDate: { lt: new Date(today) }, OR: [{ checkIn: null }, { checkOut: null }] }] };
}
export function deviceMetadata(notes: string | null) {
  try {
    const value = JSON.parse(notes || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const text = (key: string) => typeof value[key] === "string" ? value[key].slice(0, 200) : "";
    return text("source") ? { source: text("source"), deviceName: text("deviceName"), receivedAt: text("receivedAt") } : null;
  } catch { return null; }
}
export function attendanceTiming(row: { workDate: Date; checkIn: Date | null; checkOut: Date | null }, shift?: { name: string; startTime: string; endTime: string } | null) {
  const duration = row.checkIn && row.checkOut ? (row.checkOut.getTime() - row.checkIn.getTime()) / 3600000 : null;
  // Never invent a 09:00 shift for an unassigned employee or use the server timezone.
  const start = shift && /^\d{2}:\d{2}$/.test(shift.startTime) ? new Date(`${row.workDate.toISOString().slice(0, 10)}T${shift.startTime}:00+03:00`) : null;
  return { workedHours: duration !== null && duration >= 0 ? Math.round(duration * 100) / 100 : null, invalidTimes: duration !== null && duration < 0, lateMinutes: start && row.checkIn ? Math.max(0, Math.floor((row.checkIn.getTime() - start.getTime()) / 60000)) : null };
}
