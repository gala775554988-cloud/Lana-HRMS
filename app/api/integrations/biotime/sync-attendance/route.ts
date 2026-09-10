import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { decryptSecret } from "@/lib/integrations/security";
import { riyadhWorkDate } from "@/lib/attendance/sites";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

type BioTimeTransaction = {
  id?: number | string;
  emp_code?: string;
  punch_time?: string;
  punch_state?: string | number;
  punch_state_display?: string;
  terminal_sn?: string;
  terminal_alias?: string;
  area_alias?: string;
  verify_type_display?: string;
  [key: string]: unknown;
};

type ParsedPunch = {
  row: BioTimeTransaction;
  employeeId: string;
  empCode: string;
  timestamp: Date;
  workDate: Date;
  action: "checkin" | "checkout" | null;
};

function clean(value: unknown) { return String(value ?? "").trim(); }

function todayRange(dateText?: string) {
  const base = dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ? dateText
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  return { startTime: `${base} 00:00:00`, endTime: `${base} 23:59:59`, date: base };
}

function bioTimeUrl(baseUrl: string, path: string) { return `${baseUrl.replace(/\/$/, "")}${path}`; }

async function bioTimeLogin(baseUrl: string, username: string, password: string) {
  const response = await fetch(bioTimeUrl(baseUrl, "/jwt-api-token-auth/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  const token = json.token || json.access || json.jwt || json.access_token;
  if (!response.ok || !token) throw new Error(`فشل تسجيل الدخول إلى BioTime (HTTP ${response.status}).`);
  return String(token);
}

function rowsFromResponse(json: any): BioTimeTransaction[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return [];
}

function transactionAction(row: BioTimeTransaction) {
  const state = clean(row.punch_state).toLowerCase();
  const display = clean(row.punch_state_display).toLowerCase();
  if (state === "0" || display.includes("check in") || display.includes("دخول")) return "checkin" as const;
  if (state === "1" || display.includes("check out") || display.includes("خروج")) return "checkout" as const;
  return null;
}

function parsePunchTime(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const parsed = new Date(raw.replace(" ", "T") + (hasTimezone ? "" : "+03:00"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minDate(values: Array<Date | null | undefined>) {
  const valid = values.filter((value): value is Date => Boolean(value));
  return valid.length ? new Date(Math.min(...valid.map((value) => value.getTime()))) : null;
}

function maxDate(values: Array<Date | null | undefined>) {
  const valid = values.filter((value): value is Date => Boolean(value));
  return valid.length ? new Date(Math.max(...valid.map((value) => value.getTime()))) : null;
}

export async function POST(request: NextRequest) {
  let connectionId: string | null = null;
  try {
    const session = await requireOdooIntegrationAccess("manage", request);
    const body = await request.json().catch(() => ({}));
    const provider = await prisma.integrationProvider.findUnique({ where: { code: "biotime" } });
    const stored = provider ? await prisma.integrationConnection.findFirst({ where: { providerId: provider.id }, orderBy: { updatedAt: "desc" } }) : null;
    connectionId = stored?.id ?? null;

    const baseUrl = clean(body.baseUrl || stored?.baseUrl || process.env.BIOTIME_URL).replace(/\/$/, "");
    const username = clean(body.username || stored?.username || process.env.BIOTIME_USERNAME);
    const password = clean(body.password || decryptSecret(stored?.secretCipher) || process.env.BIOTIME_PASSWORD);
    if (!baseUrl) return NextResponse.json({ success: false, message: "رابط BioTime غير مهيأ." }, { status: 400 });
    if (!username || !password) return NextResponse.json({ success: false, message: "حساب BioTime غير مهيأ." }, { status: 400 });

    const range = todayRange(clean(body.date));
    const startTime = clean(body.startTime) || range.startTime;
    const endTime = clean(body.endTime) || range.endTime;
    const terminalAlias = clean(body.terminalAlias);
    const pageSize = Math.min(Math.max(Number(body.pageSize || 200), 10), 500);
    const maxPages = Math.min(Math.max(Number(body.maxPages || 100), 1), 200);
    const dryRun = Boolean(body.dryRun);

    const token = await bioTimeLogin(baseUrl, username, password);
    if (stored) await prisma.integrationConnection.update({ where: { id: stored.id }, data: { status: "CONNECTED", lastTestAt: new Date(), lastError: null } });

    const allRows: BioTimeTransaction[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(bioTimeUrl(baseUrl, "/iclock/api/transactions/"));
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(pageSize));
      url.searchParams.set("start_time", startTime);
      url.searchParams.set("end_time", endTime);
      if (terminalAlias) url.searchParams.set("terminal_alias", terminalAlias);
      const response = await fetch(url, { headers: { Authorization: `JWT ${token}` }, cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`فشل جلب حركات BioTime (HTTP ${response.status}).`);
      const rows = rowsFromResponse(json);
      allRows.push(...rows);
      if (!json?.next || rows.length === 0) break;
    }

    const codes = [...new Set(allRows.map((row) => clean(row.emp_code)).filter(Boolean))];
    const employees = codes.length ? await prisma.employee.findMany({
      where: { OR: [{ employeeNumber: { in: codes } }, { nationalId: { in: codes } }] },
      select: { id: true, employeeNumber: true, nationalId: true },
    }) : [];
    const employeeByCode = new Map<string, typeof employees[number]>();
    for (const employee of employees) {
      employeeByCode.set(employee.employeeNumber, employee);
      employeeByCode.set(employee.nationalId, employee);
    }

    const groups = new Map<string, ParsedPunch[]>();
    const notFound = new Map<string, number>();
    const errors: Array<Record<string, unknown>> = [];
    let unknownStates = 0;
    for (const row of allRows) {
      const empCode = clean(row.emp_code);
      const employee = employeeByCode.get(empCode);
      const timestamp = parsePunchTime(row.punch_time);
      if (!empCode || !timestamp) {
        errors.push({ transactionId: row.id, empCode, reason: "بيانات الكود أو وقت البصمة غير صالحة" });
        continue;
      }
      if (!employee) {
        notFound.set(empCode, (notFound.get(empCode) ?? 0) + 1);
        continue;
      }
      const action = transactionAction(row);
      if (!action) unknownStates += 1;
      const workDate = riyadhWorkDate(timestamp);
      const key = `${employee.id}:${workDate.toISOString()}`;
      const list = groups.get(key) ?? [];
      list.push({ row, employeeId: employee.id, empCode, timestamp, workDate, action });
      groups.set(key, list);
    }

    let savedDays = 0;
    let checkins = 0;
    let checkouts = 0;
    const samples: Array<Record<string, unknown>> = [];
    for (const punches of groups.values()) {
      punches.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const first = punches[0];
      const existing = await prisma.attendanceRecord.findUnique({ where: { employeeId_workDate: { employeeId: first.employeeId, workDate: first.workDate } } });
      const explicitIns = punches.filter((punch) => punch.action === "checkin").map((punch) => punch.timestamp);
      const explicitOuts = punches.filter((punch) => punch.action === "checkout").map((punch) => punch.timestamp);
      const inferredIn = explicitIns.length ? null : punches[0]?.timestamp;
      const inferredOut = explicitOuts.length ? null : (punches.length > 1 ? punches[punches.length - 1]?.timestamp : null);
      const checkIn = minDate([existing?.checkIn, ...explicitIns, inferredIn]);
      const checkOutCandidate = maxDate([existing?.checkOut, ...explicitOuts, inferredOut]);
      const checkOut = checkOutCandidate && checkIn && checkOutCandidate > checkIn ? checkOutCandidate : existing?.checkOut ?? null;
      const notes = JSON.stringify({
        source: "BIOTIME_9_5",
        empCode: first.empCode,
        punches: punches.slice(0, 100).map((punch) => ({ id: punch.row.id, at: punch.timestamp.toISOString(), action: punch.action, terminal: punch.row.terminal_alias || punch.row.terminal_sn, verifyType: punch.row.verify_type_display })),
        receivedCount: punches.length,
        syncedAt: new Date().toISOString(),
      });

      samples.push({ employeeId: first.employeeId, empCode: first.empCode, workDate: first.workDate, checkIn, checkOut, punches: punches.length });
      if (dryRun) continue;
      await prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: first.employeeId, workDate: first.workDate } },
        update: { checkIn, checkOut, status: "PRESENT", notes },
        create: { employeeId: first.employeeId, workDate: first.workDate, checkIn, checkOut, status: "PRESENT", notes },
      });
      savedDays += 1;
      if (checkIn) checkins += 1;
      if (checkOut) checkouts += 1;
    }

    const result = {
      success: errors.length === 0,
      complete: errors.length === 0 && notFound.size === 0,
      date: range.date,
      fetched: allRows.length,
      processedDays: groups.size,
      saved: dryRun ? 0 : savedDays,
      checkins,
      checkouts,
      skippedUnknownState: unknownStates,
      notFoundCount: [...notFound.values()].reduce((total, count) => total + count, 0),
      unmatchedEmployeeCodes: [...notFound.entries()].slice(0, 50).map(([empCode, punches]) => ({ empCode, punches })),
      errorsCount: errors.length,
      errors: errors.slice(0, 50),
      dryRun,
      samples: samples.slice(0, 50),
    };

    await writeAuditLog({ actorUserId: session.user.id, action: "biotime-attendance:sync", entity: "BioTimeAttendance", entityId: range.date, metadata: result as any }).catch(() => undefined);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (connectionId) await prisma.integrationConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastTestAt: new Date(), lastError: message } }).catch(() => undefined);
    return NextResponse.json({ success: false, complete: false, message }, { status: 500 });
  }
}
