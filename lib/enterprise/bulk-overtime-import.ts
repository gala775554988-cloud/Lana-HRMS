import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getAccessProfile, canAccessEmployeeId } from "@/lib/enterprise/hierarchy";
import { calculateHours, createOvertimeRequest } from "@/lib/enterprise/overtime";

export type BulkOvertimeRow = {
  rowNumber: number;
  employeeNumber: string;
  nationalId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  hours: string;
  overtimeType: string;
  notes: string;
};

type ImportError = { row: number; field?: string; message: string };

const HEADER_ALIASES: Record<string, string> = {
  "رقم الموظف": "employeeNumber",
  "الرقم الوظيفي": "employeeNumber",
  "employee number": "employeeNumber",
  "employeenumber": "employeeNumber",
  "رقم الهوية": "nationalId",
  "national id": "nationalId",
  "nationalid": "nationalId",
  "التاريخ": "workDate",
  "تاريخ العمل": "workDate",
  "work date": "workDate",
  "workdate": "workDate",
  "date": "workDate",
  "وقت البداية": "startTime",
  "start time": "startTime",
  "starttime": "startTime",
  "وقت النهاية": "endTime",
  "end time": "endTime",
  "endtime": "endTime",
  "عدد الساعات": "hours",
  "الساعات": "hours",
  "hours": "hours",
  "نوع الأوفر تايم": "overtimeType",
  "النوع": "overtimeType",
  "overtime type": "overtimeType",
  "overtimetype": "overtimeType",
  "type": "overtimeType",
  "ملاحظات": "notes",
  "notes": "notes",
  "reason": "notes"
};

const TEMPLATE_COLUMNS = [
  "رقم الموظف (Employee Number)",
  "رقم الهوية (National ID)",
  "التاريخ (Work Date)",
  "وقت البداية (Start Time)",
  "وقت النهاية (End Time)",
  "عدد الساعات (Hours)",
  "نوع الأوفر تايم (regular/night/holiday)",
  "ملاحظات (Notes)"
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function createOvertimeImportTemplateBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Overtime");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

export function parseOvertimeImportFile(buffer: Buffer): BulkOvertimeRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rawRows
    .map((raw, index) => {
      const normalized: Record<string, unknown> = {};
      for (const [header, value] of Object.entries(raw)) {
        const key = HEADER_ALIASES[normalizeHeader(header)] ?? header;
        normalized[key] = value;
      }
      return {
        rowNumber: index + 2,
        employeeNumber: getString(normalized, "employeeNumber"),
        nationalId: getString(normalized, "nationalId"),
        workDate: getString(normalized, "workDate"),
        startTime: getString(normalized, "startTime"),
        endTime: getString(normalized, "endTime"),
        hours: getString(normalized, "hours"),
        overtimeType: getString(normalized, "overtimeType") || "regular",
        notes: getString(normalized, "notes")
      } satisfies BulkOvertimeRow;
    })
    .filter((row) => row.employeeNumber || row.nationalId || row.workDate || row.hours);
}

type ResolvedRow = BulkOvertimeRow & {
  employeeId?: string;
  parsedWorkDate?: Date;
  parsedHours?: number;
};

type AccessProfile = Awaited<ReturnType<typeof getAccessProfile>> | { isSuperAdmin: true; isHrManager: false; userId: string; roles: string[]; employee: null; store: Record<string, unknown> };

async function buildAccessProfile(userId: string, roles: string[]): Promise<AccessProfile> {
  if (roles.includes("SUPER_ADMIN")) {
    return { isSuperAdmin: true, isHrManager: false, userId, roles, employee: null, store: {} };
  }
  return getAccessProfile(userId, roles);
}

async function resolveRows(rows: BulkOvertimeRow[], accessProfile: AccessProfile) {
  const employeeNumbers = rows.map((row) => row.employeeNumber).filter(Boolean);
  const nationalIds = rows.map((row) => row.nationalId).filter(Boolean);
  const orConditions = [
    employeeNumbers.length ? { employeeNumber: { in: employeeNumbers } } : null,
    nationalIds.length ? { nationalId: { in: nationalIds } } : null
  ].filter((condition): condition is { employeeNumber: { in: string[] } } | { nationalId: { in: string[] } } => condition !== null);

  const employees = orConditions.length
    ? await prisma.employee.findMany({ where: { OR: orConditions }, select: { id: true, employeeNumber: true, nationalId: true } })
    : [];
  const byNumber = new Map(employees.map((employee) => [employee.employeeNumber, employee.id]));
  const byNationalId = new Map(employees.map((employee) => [employee.nationalId, employee.id]));

  const resolved: ResolvedRow[] = [];
  const errors: ImportError[] = [];

  for (const row of rows) {
    const employeeId = (row.employeeNumber && byNumber.get(row.employeeNumber)) || (row.nationalId && byNationalId.get(row.nationalId)) || undefined;
    if (!employeeId) {
      errors.push({ row: row.rowNumber, field: "employeeNumber", message: "لم يتم العثور على الموظف (تحقق من الرقم الوظيفي أو رقم الهوية)" });
      resolved.push({ ...row });
      continue;
    }
    if (!(await canAccessEmployeeId(employeeId, accessProfile as any))) {
      errors.push({ row: row.rowNumber, field: "employeeNumber", message: "لا تملك صلاحية إضافة أوفر تايم لهذا الموظف" });
      resolved.push({ ...row, employeeId });
      continue;
    }
    const parsedWorkDate = parseDateValue(row.workDate);
    if (!parsedWorkDate) {
      errors.push({ row: row.rowNumber, field: "workDate", message: "تاريخ غير صالح" });
      resolved.push({ ...row, employeeId });
      continue;
    }
    const parsedHours = calculateHours(row.startTime, row.endTime, Number(row.hours) || undefined);
    if (!parsedHours || parsedHours <= 0) {
      errors.push({ row: row.rowNumber, field: "hours", message: "يجب إدخال عدد ساعات أو وقت بداية/نهاية صحيح" });
      resolved.push({ ...row, employeeId, parsedWorkDate });
      continue;
    }
    if (parsedHours > 24) {
      errors.push({ row: row.rowNumber, field: "hours", message: "عدد الساعات أكبر من 24 ساعة في اليوم" });
      resolved.push({ ...row, employeeId, parsedWorkDate, parsedHours });
      continue;
    }
    resolved.push({ ...row, employeeId, parsedWorkDate, parsedHours });
  }

  return { resolved, errors };
}

export async function analyzeOvertimeImport(rows: BulkOvertimeRow[], userId: string, roles: string[]) {
  const accessProfile = await buildAccessProfile(userId, roles);
  const { errors } = await resolveRows(rows, accessProfile);
  const errorRowNumbers = new Set(errors.map((error) => error.row));
  return {
    totalRows: rows.length,
    validRows: rows.length - errorRowNumbers.size,
    errorRows: errorRowNumbers.size,
    errors
  };
}

export async function importOvertimeRows(rows: BulkOvertimeRow[], userId: string, roles: string[]) {
  const accessProfile = await buildAccessProfile(userId, roles);
  const { resolved, errors } = await resolveRows(rows, accessProfile);
  const errorRowNumbers = new Set(errors.map((error) => error.row));

  let added = 0;
  const runtimeErrors: ImportError[] = [...errors];

  for (const row of resolved) {
    if (errorRowNumbers.has(row.rowNumber)) continue;
    if (!row.employeeId || !row.parsedWorkDate || !row.parsedHours) continue;
    try {
      await createOvertimeRequest({
        employeeId: row.employeeId,
        workDate: row.parsedWorkDate,
        hours: row.parsedHours,
        overtimeType: row.overtimeType || "regular",
        notes: row.notes,
        actorUserId: userId,
        extra: { source: "bulk-import", employeeNumber: row.employeeNumber }
      });
      added += 1;
    } catch (error) {
      runtimeErrors.push({ row: row.rowNumber, message: error instanceof Error ? error.message : "فشل إنشاء السجل" });
    }
  }

  const analysis = { totalRows: rows.length, validRows: rows.length - errorRowNumbers.size, errorRows: errorRowNumbers.size, errors: runtimeErrors };
  return {
    success: added > 0,
    analysis,
    result: { added, updated: 0, skipped: rows.length - added, errors: runtimeErrors.length, total: rows.length }
  };
}
