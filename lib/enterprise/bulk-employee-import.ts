import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { extractSalaryProfile, saveEmployeeSalaryProfile } from "@/lib/employee/salary-profile";
import { requirePasswordChange } from "@/lib/auth/password-change-policy";
import { getHierarchyStore, type HierarchyStore } from "@/lib/enterprise/hierarchy";
import { writeAuditLog } from "@/lib/audit";

export type DuplicateStrategy = "skip" | "update" | "ignore";

export type BulkImportOptions = {
  autoCreateReferences?: boolean;
  duplicateStrategy?: DuplicateStrategy;
};

export type BulkImportError = {
  row: number;
  field?: string;
  message: string;
};

export type ParsedEmployeeRow = {
  rowNumber: number;
  fullName: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  nationalId: string;
  nationality?: string;
  gender?: string;
  dateOfBirth?: Date;
  phone?: string;
  personalEmail?: string;
  workEmail?: string;
  address?: string;
  department?: string;
  branch?: string;
  section?: string;
  position?: string;
  employmentType?: string;
  contractType?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
  status?: string;
  location?: string;
  workLocation?: string;
  hospital?: string;
  sponsor?: string;
  bankName?: string;
  iban?: string;
  costCenter?: string;
  leaveBalance?: number;
  leaveUsed?: number;
  profilePhotoUrl?: string;
  supervisor?: string;
  branchManager?: string;
  departmentManager?: string;
  projectManager?: string;
  project?: string;
  salaryValues: Record<string, unknown>;
  extraValues: Record<string, unknown>;
};

export const BULK_IMPORT_COLUMNS = [
  { key: "fullName", label: "الاسم الكامل", aliases: ["full name", "name", "الاسم", "اسم الموظف"] },
  { key: "employeeNumber", label: "رقم الموظف", aliases: ["employee number", "employee no", "emp no", "الرقم الوظيفي"] },
  { key: "nationalId", label: "رقم الهوية", aliases: ["national id", "nationalid", "id number", "identity", "الهوية", "الهوية الوطنية", "رقم الهوية الوطنية"] },
  { key: "nationality", label: "الجنسية", aliases: ["nationality"] },
  { key: "gender", label: "الجنس", aliases: ["gender"] },
  { key: "dateOfBirth", label: "تاريخ الميلاد", aliases: ["date of birth", "birth date", "dob"] },
  { key: "phone", label: "رقم الجوال", aliases: ["mobile", "phone", "رقم الهاتف", "الجوال"] },
  { key: "personalEmail", label: "البريد الشخصي", aliases: ["personal email", "private email"] },
  { key: "workEmail", label: "البريد الوظيفي", aliases: ["work email", "email", "company email", "البريد الإلكتروني"] },
  { key: "address", label: "العنوان", aliases: ["address"] },
  { key: "department", label: "الإدارة", aliases: ["department"] },
  { key: "branch", label: "الفرع", aliases: ["branch"] },
  { key: "section", label: "القسم", aliases: ["section"] },
  { key: "position", label: "المنصب", aliases: ["position", "job title", "title"] },
  { key: "employmentType", label: "نوع التوظيف", aliases: ["employment type", "employmenttype"] },
  { key: "contractType", label: "نوع العقد", aliases: ["contract type"] },
  { key: "contractStartDate", label: "تاريخ بداية العقد", aliases: ["contract start date", "start date", "hire date", "تاريخ التعيين"] },
  { key: "contractEndDate", label: "تاريخ نهاية العقد", aliases: ["contract end date", "end date"] },
  { key: "status", label: "الحالة", aliases: ["status"] },
  { key: "location", label: "الموقع", aliases: ["location"] },
  { key: "workLocation", label: "موقع العمل", aliases: ["work location"] },
  { key: "hospital", label: "المستشفى", aliases: ["hospital"] },
  { key: "sponsor", label: "Sponsor", aliases: ["sponsor", "الكفيل"] },
  { key: "bankName", label: "اسم البنك", aliases: ["bank name", "bank"] },
  { key: "iban", label: "IBAN", aliases: ["iban"] },
  { key: "salaryBase", label: "الراتب الأساسي", aliases: ["base salary", "salary base"] },
  { key: "salaryHousingAllowance", label: "بدل السكن", aliases: ["housing allowance"] },
  { key: "salaryTransportAllowance", label: "بدل النقل", aliases: ["transport allowance"] },
  { key: "salaryOtherAllowances", label: "بدلات أخرى", aliases: ["other allowances"] },
  { key: "salaryDeductions", label: "الخصومات", aliases: ["deductions"] },
  { key: "salaryDeductInsurance", label: "خصم التأمينات", aliases: ["deduct insurance", "insurance deduction"] },
  { key: "salaryTotal", label: "إجمالي الراتب", aliases: ["total salary"] },
  { key: "salaryCosts", label: "التكلفة", aliases: ["cost"] },
  { key: "costCenter", label: "مركز التكلفة", aliases: ["cost center"] },
  { key: "leaveBalance", label: "رصيد الإجازات", aliases: ["leave balance"] },
  { key: "leaveUsed", label: "المستخدم من الإجازات", aliases: ["leave used", "used leave"] },
  { key: "profilePhotoUrl", label: "صورة الموظف (اختياري)", aliases: ["employee photo", "photo", "profile photo", "profilePhotoUrl"] },
  { key: "supervisor", label: "Supervisor", aliases: ["supervisor", "direct manager", "المشرف", "المدير المباشر"] },
  { key: "branchManager", label: "Branch Manager", aliases: ["branch manager", "مدير الفرع"] },
  { key: "departmentManager", label: "Department Manager", aliases: ["department manager", "مدير الإدارة"] },
  { key: "projectManager", label: "Project Manager", aliases: ["project manager", "مدير المشروع"] },
  { key: "project", label: "المشروع", aliases: ["project"] }
] as const;

const aliasToKey = new Map<string, string>();
for (const column of BULK_IMPORT_COLUMNS) {
  aliasToKey.set(normalizeHeader(column.label), column.key);
  aliasToKey.set(normalizeHeader(column.key), column.key);
  for (const alias of column.aliases) aliasToKey.set(normalizeHeader(alias), column.key);
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_\-.()]/g, "").trim();
}

function normalizeLookup(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeCode(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return cleaned || `REF-${Date.now()}`;
}

function getString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value === undefined || value === null ? "" : String(value).trim();
}

function getNumber(row: Record<string, unknown>, key: string) {
  const value = getString(row, key);
  if (!value) return undefined;
  const normalized = value.replace(/,/g, "");
  const numberValue = Number(normalized);
  return Number.isNaN(numberValue) ? undefined : numberValue;
}

function getBoolean(row: Record<string, unknown>, key: string) {
  const value = getString(row, key).toLowerCase();
  return ["true", "yes", "1", "y", "نعم", "صح"].includes(value);
}

function parseDateValue(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || parts[0] || ""
  };
}

function normalizeStatus(value: string) {
  const normalized = normalizeLookup(value);
  if (!normalized) return "ACTIVE";
  if (["active", "نشط"].includes(normalized)) return "ACTIVE";
  if (["on_leave", "onleave", "فيإجازة", "اجازة", "إجازة"].includes(normalized)) return "ON_LEAVE";
  if (["terminated", "منتهي", "موقوف"].includes(normalized)) return "TERMINATED";
  if (["inactive", "غيرنشط"].includes(normalized)) return "INACTIVE";
  return value.toUpperCase();
}

export function createEmployeeImportTemplateBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([BULK_IMPORT_COLUMNS.map((column) => column.label)]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

export function parseEmployeeImportFile(buffer: Buffer, fileName: string): ParsedEmployeeRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rawRows.map((raw, index) => {
    const normalized: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(raw)) {
      const key = aliasToKey.get(normalizeHeader(header)) ?? header;
      normalized[key] = value;
    }
    const fullName = getString(normalized, "fullName");
    const { firstName, lastName } = splitFullName(fullName);
    const salaryValues = {
      salaryBase: getNumber(normalized, "salaryBase"),
      salaryHousingAllowance: getNumber(normalized, "salaryHousingAllowance"),
      salaryTransportAllowance: getNumber(normalized, "salaryTransportAllowance"),
      salaryOtherAllowances: getNumber(normalized, "salaryOtherAllowances"),
      salaryDeductions: getNumber(normalized, "salaryDeductions"),
      salaryDeductInsurance: getBoolean(normalized, "salaryDeductInsurance"),
      salaryTotal: getNumber(normalized, "salaryTotal"),
      salaryCosts: getNumber(normalized, "salaryCosts")
    };
    return {
      rowNumber: index + 2,
      fullName,
      firstName,
      lastName,
      employeeNumber: getString(normalized, "employeeNumber"),
      nationalId: getString(normalized, "nationalId"),
      nationality: getString(normalized, "nationality"),
      gender: getString(normalized, "gender"),
      dateOfBirth: parseDateValue(getString(normalized, "dateOfBirth")),
      phone: getString(normalized, "phone"),
      personalEmail: normalizeEmail(getString(normalized, "personalEmail")),
      workEmail: normalizeEmail(getString(normalized, "workEmail")),
      address: getString(normalized, "address"),
      department: getString(normalized, "department"),
      branch: getString(normalized, "branch"),
      section: getString(normalized, "section"),
      position: getString(normalized, "position"),
      employmentType: getString(normalized, "employmentType"),
      contractType: getString(normalized, "contractType"),
      contractStartDate: parseDateValue(getString(normalized, "contractStartDate")),
      contractEndDate: parseDateValue(getString(normalized, "contractEndDate")),
      status: normalizeStatus(getString(normalized, "status")),
      location: getString(normalized, "location"),
      workLocation: getString(normalized, "workLocation"),
      hospital: getString(normalized, "hospital"),
      sponsor: getString(normalized, "sponsor"),
      bankName: getString(normalized, "bankName"),
      iban: getString(normalized, "iban"),
      costCenter: getString(normalized, "costCenter"),
      leaveBalance: getNumber(normalized, "leaveBalance"),
      leaveUsed: getNumber(normalized, "leaveUsed"),
      profilePhotoUrl: getString(normalized, "profilePhotoUrl"),
      supervisor: getString(normalized, "supervisor"),
      branchManager: getString(normalized, "branchManager"),
      departmentManager: getString(normalized, "departmentManager"),
      projectManager: getString(normalized, "projectManager"),
      project: getString(normalized, "project"),
      salaryValues,
      extraValues: { fileName, contractType: getString(normalized, "contractType"), contractEndDate: getString(normalized, "contractEndDate"), location: getString(normalized, "location"), workLocation: getString(normalized, "workLocation"), hospital: getString(normalized, "hospital"), sponsor: getString(normalized, "sponsor"), bankName: getString(normalized, "bankName"), iban: getString(normalized, "iban"), costCenter: getString(normalized, "costCenter"), leaveBalance: getNumber(normalized, "leaveBalance"), leaveUsed: getNumber(normalized, "leaveUsed"), personalEmail: normalizeEmail(getString(normalized, "personalEmail")) }
    } satisfies ParsedEmployeeRow;
  }).filter((row) => Object.values(row).some((value) => value !== "" && value !== undefined && value !== null));
}

async function loadReferences() {
  const [departments, branches, positions, employmentTypes, nationalities, employees] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true, code: true } }),
    prisma.branch.findMany({ select: { id: true, name: true, code: true } }),
    prisma.position.findMany({ select: { id: true, title: true, code: true } }),
    prisma.employmentType.findMany({ select: { id: true, name: true, code: true } }),
    prisma.nationality.findMany({ select: { id: true, name: true, code: true } }),
    prisma.employee.findMany({ select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, email: true, userId: true } })
  ]);
  return { departments, branches, positions, employmentTypes, nationalities, employees };
}

function indexRefs<T extends { id: string; name?: string; title?: string; code?: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item.name) map.set(normalizeLookup(item.name), item);
    if (item.title) map.set(normalizeLookup(item.title), item);
    if (item.code) map.set(normalizeLookup(item.code), item);
  }
  return map;
}

function indexEmployees(items: Array<{ id: string; employeeNumber: string; nationalId: string; firstName: string; lastName: string; email: string | null }>) {
  const map = new Map<string, { id: string; employeeNumber: string; nationalId: string; firstName: string; lastName: string; email: string | null }>();
  for (const item of items) {
    map.set(normalizeLookup(item.employeeNumber), item);
    map.set(normalizeLookup(item.nationalId), item);
    if (item.email) map.set(normalizeLookup(item.email), item);
    map.set(normalizeLookup(`${item.firstName} ${item.lastName}`), item);
  }
  return map;
}

export async function analyzeEmployeeImport(rows: ParsedEmployeeRow[], options: BulkImportOptions = {}) {
  const references = await loadReferences();
  const departmentMap = indexRefs(references.departments);
  const branchMap = indexRefs(references.branches);
  const positionMap = indexRefs(references.positions);
  const employmentTypeMap = indexRefs(references.employmentTypes);
  const nationalityMap = indexRefs(references.nationalities);
  const employeeMap = indexEmployees(references.employees);
  const fileEmployeeRefs = new Set<string>();
  const errors: BulkImportError[] = [];
  const seenNationalIds = new Map<string, number>();
  const seenEmployeeNumbers = new Map<string, number>();
  let duplicates = 0;

  for (const row of rows) {
    if (row.employeeNumber) fileEmployeeRefs.add(normalizeLookup(row.employeeNumber));
    if (row.nationalId) fileEmployeeRefs.add(normalizeLookup(row.nationalId));
    if (row.fullName) fileEmployeeRefs.add(normalizeLookup(row.fullName));
    if (row.workEmail) fileEmployeeRefs.add(normalizeLookup(row.workEmail));
  }

  const missingReferences = {
    departments: new Set<string>(),
    branches: new Set<string>(),
    positions: new Set<string>(),
    employmentTypes: new Set<string>(),
    nationalities: new Set<string>()
  };

  for (const row of rows) {
    if (!row.fullName) errors.push({ row: row.rowNumber, field: "الاسم الكامل", message: "الاسم الكامل مطلوب." });
    if (!row.employeeNumber) errors.push({ row: row.rowNumber, field: "رقم الموظف", message: "رقم الموظف مطلوب." });
    if (!row.nationalId) errors.push({ row: row.rowNumber, field: "رقم الهوية", message: "رقم الهوية مطلوب." });
    if (row.workEmail && !isValidEmail(row.workEmail)) errors.push({ row: row.rowNumber, field: "البريد الوظيفي", message: "البريد الإلكتروني غير صحيح." });
    if (row.personalEmail && !isValidEmail(row.personalEmail)) errors.push({ row: row.rowNumber, field: "البريد الشخصي", message: "البريد الإلكتروني غير صحيح." });

    const nationalKey = normalizeLookup(row.nationalId);
    const employeeKey = normalizeLookup(row.employeeNumber);
    if (nationalKey && seenNationalIds.has(nationalKey)) {
      duplicates++;
      errors.push({ row: row.rowNumber, field: "رقم الهوية", message: `رقم الهوية مكرر داخل الملف. مكرر مع الصف ${seenNationalIds.get(nationalKey)}.` });
    } else if (nationalKey) seenNationalIds.set(nationalKey, row.rowNumber);
    if (employeeKey && seenEmployeeNumbers.has(employeeKey)) {
      duplicates++;
      errors.push({ row: row.rowNumber, field: "رقم الموظف", message: `رقم الموظف مكرر داخل الملف. مكرر مع الصف ${seenEmployeeNumbers.get(employeeKey)}.` });
    } else if (employeeKey) seenEmployeeNumbers.set(employeeKey, row.rowNumber);

    if (row.department && !departmentMap.has(normalizeLookup(row.department))) missingReferences.departments.add(row.department);
    if (row.branch && !branchMap.has(normalizeLookup(row.branch))) missingReferences.branches.add(row.branch);
    if ((row.position || row.section) && !positionMap.has(normalizeLookup(row.position || row.section || ""))) missingReferences.positions.add(row.position || row.section || "");
    if (row.employmentType && !employmentTypeMap.has(normalizeLookup(row.employmentType))) missingReferences.employmentTypes.add(row.employmentType);
    if (row.nationality && !nationalityMap.has(normalizeLookup(row.nationality))) missingReferences.nationalities.add(row.nationality);

    for (const [field, value] of [["Supervisor", row.supervisor], ["Branch Manager", row.branchManager], ["Department Manager", row.departmentManager], ["Project Manager", row.projectManager]] as const) {
      if (value && !employeeMap.has(normalizeLookup(value)) && !fileEmployeeRefs.has(normalizeLookup(value))) {
        errors.push({ row: row.rowNumber, field, message: `${field} غير موجود.` });
      }
    }
  }

  if (!options.autoCreateReferences) {
    for (const [key, values] of Object.entries(missingReferences)) {
      for (const value of values) errors.push({ row: 0, field: key, message: `${value} غير موجود.` });
    }
  }

  const existingNationalIds = new Set(references.employees.map((employee) => normalizeLookup(employee.nationalId)));
  const existingEmployeeNumbers = new Set(references.employees.map((employee) => normalizeLookup(employee.employeeNumber)));
  const existingRows = rows.filter((row) => existingNationalIds.has(normalizeLookup(row.nationalId)) || existingEmployeeNumbers.has(normalizeLookup(row.employeeNumber)));
  const newRows = rows.filter((row) => !existingNationalIds.has(normalizeLookup(row.nationalId)) && !existingEmployeeNumbers.has(normalizeLookup(row.employeeNumber)));

  return {
    totalRows: rows.length,
    validRows: Math.max(rows.length - errors.filter((error) => error.row > 0).length, 0),
    errorRows: new Set(errors.filter((error) => error.row > 0).map((error) => error.row)).size,
    duplicates: duplicates + existingRows.length,
    newEmployees: newRows.length,
    existingEmployees: existingRows.length,
    missingReferences: Object.fromEntries(Object.entries(missingReferences).map(([key, values]) => [key, Array.from(values)])),
    errors
  };
}

async function ensureReferences(rows: ParsedEmployeeRow[], autoCreate: boolean) {
  if (!autoCreate) return loadReferences();
  const references = await loadReferences();
  const departmentMap = indexRefs(references.departments);
  const branchMap = indexRefs(references.branches);
  const positionMap = indexRefs(references.positions);
  const employmentTypeMap = indexRefs(references.employmentTypes);
  const nationalityMap = indexRefs(references.nationalities);

  const missingDepartments = Array.from(new Set(rows.map((row) => row.department).filter((value): value is string => Boolean(value && !departmentMap.has(normalizeLookup(value))))));
  const missingBranches = Array.from(new Set(rows.map((row) => row.branch).filter((value): value is string => Boolean(value && !branchMap.has(normalizeLookup(value))))));
  const missingPositions = Array.from(new Set(rows.map((row) => row.position || row.section).filter((value): value is string => Boolean(value && !positionMap.has(normalizeLookup(value))))));
  const missingEmploymentTypes = Array.from(new Set(rows.map((row) => row.employmentType).filter((value): value is string => Boolean(value && !employmentTypeMap.has(normalizeLookup(value))))));
  const missingNationalities = Array.from(new Set(rows.map((row) => row.nationality).filter((value): value is string => Boolean(value && !nationalityMap.has(normalizeLookup(value))))));

  await prisma.$transaction([
    prisma.department.createMany({ data: missingDepartments.map((name) => ({ name, code: normalizeCode(name), isActive: true })), skipDuplicates: true }),
    prisma.branch.createMany({ data: missingBranches.map((name) => ({ name, code: normalizeCode(name), isActive: true })), skipDuplicates: true }),
    prisma.position.createMany({ data: missingPositions.map((title) => ({ title, code: normalizeCode(title), isActive: true })), skipDuplicates: true }),
    prisma.employmentType.createMany({ data: missingEmploymentTypes.map((name) => ({ name, code: normalizeCode(name), isActive: true })), skipDuplicates: true }),
    prisma.nationality.createMany({ data: missingNationalities.map((name) => ({ name, code: normalizeCode(name), isActive: true })), skipDuplicates: true })
  ]);

  return loadReferences();
}

async function getPasswordHashes(rows: ParsedEmployeeRow[]) {
  const cache = new Map<string, string>();
  for (const row of rows) {
    const password = row.nationalId.slice(-4).padStart(4, "0");
    if (!cache.has(password)) cache.set(password, await hashPassword(password));
  }
  return cache;
}

export async function importEmployees(rows: ParsedEmployeeRow[], options: BulkImportOptions, actorUserId: string) {
  const duplicateStrategy = options.duplicateStrategy ?? "skip";
  const analysis = await analyzeEmployeeImport(rows, options);
  if (analysis.errors.length) return { success: false, analysis, result: null };

  const references = await ensureReferences(rows, Boolean(options.autoCreateReferences));
  const departmentMap = indexRefs(references.departments);
  const branchMap = indexRefs(references.branches);
  const positionMap = indexRefs(references.positions);
  const employmentTypeMap = indexRefs(references.employmentTypes);
  const nationalityMap = indexRefs(references.nationalities);
  const existingEmployeeByNationalId = new Map(references.employees.map((employee) => [normalizeLookup(employee.nationalId), employee]));
  const existingEmployeeByNumber = new Map(references.employees.map((employee) => [normalizeLookup(employee.employeeNumber), employee]));
  const passwordHashes = await getPasswordHashes(rows);
  const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });

  let added = 0;
  let updated = 0;
  let skipped = 0;

  const result = await prisma.$transaction(async (tx) => {
    const newRows = rows.filter((row) => !existingEmployeeByNationalId.has(normalizeLookup(row.nationalId)) && !existingEmployeeByNumber.has(normalizeLookup(row.employeeNumber)));
    const existingRows = rows.filter((row) => existingEmployeeByNationalId.has(normalizeLookup(row.nationalId)) || existingEmployeeByNumber.has(normalizeLookup(row.employeeNumber)));

    const userEmails = newRows.map((row) => row.workEmail || row.personalEmail || `employee.${row.nationalId}@lana.local`);
    await tx.user.createMany({
      data: newRows.map((row, index) => ({
        name: row.fullName,
        email: userEmails[index],
        emailVerified: new Date(),
        passwordHash: passwordHashes.get(row.nationalId.slice(-4).padStart(4, "0"))!,
        isActive: true
      })),
      skipDuplicates: true
    });
    const users = await tx.user.findMany({ where: { email: { in: userEmails } }, select: { id: true, email: true } });
    const userByEmail = new Map(users.map((user) => [normalizeLookup(user.email), user]));

    await tx.employee.createMany({
      data: newRows.map((row, index) => ({
        employeeNumber: row.employeeNumber,
        nationalId: row.nationalId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.workEmail || row.personalEmail || null,
        phone: row.phone || null,
        gender: row.gender || null,
        dateOfBirth: row.dateOfBirth,
        hireDate: row.contractStartDate ?? new Date(),
        status: row.status as any,
        address: row.address || null,
        profilePhotoUrl: row.profilePhotoUrl || null,
        userId: userByEmail.get(normalizeLookup(userEmails[index]))?.id,
        departmentId: row.department ? departmentMap.get(normalizeLookup(row.department))?.id : null,
        branchId: row.branch ? branchMap.get(normalizeLookup(row.branch))?.id : null,
        positionId: (row.position || row.section) ? positionMap.get(normalizeLookup(row.position || row.section || ""))?.id : null,
        employmentTypeId: row.employmentType ? employmentTypeMap.get(normalizeLookup(row.employmentType))?.id : null,
        nationalityId: row.nationality ? nationalityMap.get(normalizeLookup(row.nationality))?.id : null
      })),
      skipDuplicates: true
    });
    added = newRows.length;

    if (duplicateStrategy === "update") {
      for (const row of existingRows) {
        const existing = existingEmployeeByNationalId.get(normalizeLookup(row.nationalId)) ?? existingEmployeeByNumber.get(normalizeLookup(row.employeeNumber));
        if (!existing) continue;
        await tx.employee.update({
          where: { id: existing.id },
          data: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.workEmail || row.personalEmail || existing.email,
            phone: row.phone || undefined,
            gender: row.gender || undefined,
            dateOfBirth: row.dateOfBirth,
            hireDate: row.contractStartDate ?? undefined,
            status: row.status as any,
            address: row.address || undefined,
            profilePhotoUrl: row.profilePhotoUrl || undefined,
            departmentId: row.department ? departmentMap.get(normalizeLookup(row.department))?.id : undefined,
            branchId: row.branch ? branchMap.get(normalizeLookup(row.branch))?.id : undefined,
            positionId: (row.position || row.section) ? positionMap.get(normalizeLookup(row.position || row.section || ""))?.id : undefined,
            employmentTypeId: row.employmentType ? employmentTypeMap.get(normalizeLookup(row.employmentType))?.id : undefined,
            nationalityId: row.nationality ? nationalityMap.get(normalizeLookup(row.nationality))?.id : undefined
          }
        });
        updated++;
      }
    } else {
      skipped = existingRows.length;
    }

    const affectedEmployees = await tx.employee.findMany({
      where: { OR: [{ nationalId: { in: rows.map((row) => row.nationalId) } }, { employeeNumber: { in: rows.map((row) => row.employeeNumber) } }] },
      select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, email: true, userId: true, branchId: true, departmentId: true }
    });
    const affectedByNationalId = new Map(affectedEmployees.map((employee) => [normalizeLookup(employee.nationalId), employee]));
    const affectedByNumber = new Map(affectedEmployees.map((employee) => [normalizeLookup(employee.employeeNumber), employee]));
    const employeeLookup = indexEmployees([...references.employees, ...affectedEmployees]);

    if (employeeRole) {
      await tx.userRole.createMany({
        data: affectedEmployees.filter((employee) => employee.userId).map((employee) => ({ userId: employee.userId!, roleId: employeeRole.id })),
        skipDuplicates: true
      });
    }

    for (const row of rows) {
      const employee = affectedByNationalId.get(normalizeLookup(row.nationalId)) ?? affectedByNumber.get(normalizeLookup(row.employeeNumber));
      if (!employee) continue;
      await tx.appSetting.upsert({
        where: { key: `employee.extra.${employee.id}` },
        update: { value: row.extraValues as any },
        create: { key: `employee.extra.${employee.id}`, value: row.extraValues as any, description: "Bulk imported employee extra fields" }
      });
      await tx.appSetting.upsert({
        where: { key: `employee.salary.${employee.id}` },
        update: { value: extractSalaryProfile(row.salaryValues) },
        create: { key: `employee.salary.${employee.id}`, value: extractSalaryProfile(row.salaryValues), description: "Employee salary profile" }
      });
    }

    const hierarchy = await getHierarchyStore();
    const hierarchyDraft: HierarchyStore = JSON.parse(JSON.stringify(hierarchy));
    for (const row of rows) {
      const employee = affectedByNationalId.get(normalizeLookup(row.nationalId)) ?? affectedByNumber.get(normalizeLookup(row.employeeNumber));
      if (!employee) continue;
      const supervisor = row.supervisor ? employeeLookup.get(normalizeLookup(row.supervisor)) : null;
      if (supervisor) hierarchyDraft.directManagers[employee.id] = supervisor.id;
      const branchManager = row.branchManager ? employeeLookup.get(normalizeLookup(row.branchManager)) : null;
      if (branchManager && employee.branchId) hierarchyDraft.branchManagers[employee.branchId] = branchManager.id;
      const departmentManager = row.departmentManager ? employeeLookup.get(normalizeLookup(row.departmentManager)) : null;
      if (departmentManager && employee.departmentId) hierarchyDraft.departmentManagers[employee.departmentId] = departmentManager.id;
      const projectManager = row.projectManager ? employeeLookup.get(normalizeLookup(row.projectManager)) : null;
      if (projectManager) {
        const projectKey = normalizeCode(row.project || `PROJECT-${projectManager.id}`);
        const project = hierarchyDraft.projects[projectKey] ?? { name: row.project || `Project ${projectManager.employeeNumber}`, managerEmployeeId: projectManager.id, employeeIds: [] };
        project.managerEmployeeId = projectManager.id;
        project.employeeIds = Array.from(new Set([...project.employeeIds, employee.id]));
        hierarchyDraft.projects[projectKey] = project;
      }
    }
    await tx.appSetting.upsert({
      where: { key: "enterprise.hierarchy" },
      update: { value: hierarchyDraft },
      create: { key: "enterprise.hierarchy", value: hierarchyDraft, description: "Enterprise organization hierarchy mappings" }
    });

    const passwordSetting = await tx.appSetting.findUnique({ where: { key: "employee.passwordChangeRequired" } }).catch(() => null);
    const passwordStore = passwordSetting?.value && typeof passwordSetting.value === "object" ? passwordSetting.value as Record<string, boolean> : {};
    for (const employee of affectedEmployees) if (employee.userId) passwordStore[employee.userId] = true;
    await tx.appSetting.upsert({
      where: { key: "employee.passwordChangeRequired" },
      update: { value: passwordStore },
      create: { key: "employee.passwordChangeRequired", value: passwordStore, description: "Users required to change auto-generated employee password" }
    });

    return { affectedEmployees };
  }, { timeout: 120_000 });

  for (const employee of result.affectedEmployees) {
    if (employee.userId) await requirePasswordChange(employee.userId).catch(() => null);
  }
  await writeAuditLog({ actorUserId, action: "bulk-import", entity: "employee", metadata: { added, updated, skipped, total: rows.length } }).catch(() => null);

  return { success: true, analysis, result: { added, updated, skipped, errors: 0, total: rows.length } };
}
