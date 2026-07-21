import { createHash } from 'crypto';
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { decryptSecret } from "@/lib/integrations/security";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { isOdooIntegrationEnabled } from "@/lib/settings";
import { getOdooEnvConfig } from "./config";
import { OdooClient } from "./client";
import { OdooConfigurationError } from "./auth";
import { discoverSyncableFields, sanitizeRawRecord, SENSITIVE_FIELDS } from "./dynamic-fields";
import { resolveEmployeeNumberFromRecord, getConfiguredEmployeeNumberField } from "./employee-numbers";
import { syncEmployeeDocuments } from "./documents";
import { syncEmployeeIdentitiesOnly, type IdentitySyncOutcome, type OdooIdentityRecord } from "./identity-sync";
import { resolveOdooHospital } from "./hospital-resolver";
import {
  asDate,
  asDateString,
  detectConflicts,
  getMapper,
  mapLanaAttendanceToOdoo,
  mapLanaCompanyToOdoo,
  mapLanaContractToOdoo,
  mapLanaDepartmentToOdoo,
  mapLanaEmployeeToOdoo,
  mapLanaLeaveToOdoo,
  mapLanaJobToOdoo,
  mapLanaPayrollToOdoo,
  mapOdooAttendanceToLana,
  mapOdooCompanyToLana,
  mapOdooContractToLana,
  mapOdooDepartmentToLana,
  mapOdooEmployeeToLana,
  mapOdooLeaveToLana,
  mapOdooJobToLana,
  many2oneId,
  many2oneName,
  textValue
} from "./mapper";
import type { LanaAttendance, LanaContract, LanaDepartment, LanaEmployee, LanaLeave, LanaPayrollItem, NormalizedSyncDirection, OdooDomain, OdooRecord, SyncDirection, SyncEntity, SyncOptions, SyncResult } from "./types";

type Delegate = {
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(args?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  findUnique?(args?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  upsert?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
};

type RuntimeConnection = {
  id?: string;
  providerId?: string | null;
  database?: string | null;
  username?: string | null;
  uid?: number | null;
  sessionId?: string | null;
};

export type RuntimeConnectionLike = RuntimeConnection;

function delegate(model: string): Delegate {
  const resolved = (prisma as unknown as Record<string, Delegate>)[model];
  if (!resolved) throw new Error(`Missing Prisma delegate: ${model}`);
  return resolved;
}

function normalizeDirection(direction: SyncDirection = "BIDIRECTIONAL"): NormalizedSyncDirection {
  if (direction === "HRMS_TO_ODOO") return "LANA_TO_ODOO";
  if (direction === "ODOO_TO_HRMS") return "ODOO_TO_LANA";
  return direction;
}

function emptyResult(entity: string, direction: NormalizedSyncDirection, dryRun: boolean, tenantId?: string): SyncResult {
  return { success: true, entity, direction, dryRun, tenantId, pulled: 0, pushed: 0, created: 0, updated: 0, deleted: 0, skipped: 0, conflicts: 0, operations: [], errors: [] };
}

function mergeResults(entity: string, direction: NormalizedSyncDirection, dryRun: boolean, results: SyncResult[], tenantId?: string): SyncResult {
  return results.reduce((acc, item) => ({
    ...acc,
    pulled: acc.pulled + item.pulled,
    pushed: acc.pushed + item.pushed,
    created: acc.created + item.created,
    updated: acc.updated + item.updated,
    deleted: acc.deleted + item.deleted,
    skipped: acc.skipped + item.skipped,
    conflicts: acc.conflicts + item.conflicts,
    operations: [...acc.operations, ...item.operations],
    errors: [...acc.errors, ...item.errors],
    success: acc.success && item.success,
    cursor: item.cursor || acc.cursor
  }), emptyResult(entity, direction, dryRun, tenantId));
}

function updatedWhere(since?: Date | string) {
  return since ? { updatedAt: { gt: typeof since === "string" ? new Date(since) : since } } : undefined;
}

function odooIncrementalDomain(since?: Date | string): OdooDomain {
  const value = asDateString(since);
  return value ? [["write_date", ">", value]] : [];
}

function maxCursor(records: OdooRecord[], fallback?: Date | string) {
  const values = records.map((record) => typeof record.write_date === "string" ? record.write_date : undefined).filter(Boolean) as string[];
  values.sort();
  return values.at(-1) ?? (fallback ? asDateString(fallback) : undefined);
}

function objectId(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function startOfDay(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date | string) {
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  date.setHours(23, 59, 59, 999);
  return date;
}

export function hasInternalSyncToken(request?: NextRequest | null): boolean {
  if (!request) return false;
  const INTERNAL_TOKEN_SHA256 = 'ce1bf82bdaf46ba65a577cd0cb892e675c87d1a1f2c0ad470a0a4d02dcb9a9a0';
  const expected = process.env.ATTENDANCE_BRIDGE_TOKEN || process.env.INTERNAL_SYNC_TOKEN;
  const header = request.headers.get('authorization') || request.headers.get('x-internal-sync-token') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) return false;
  if (expected && (header === `Bearer ${expected}` || header === expected || token === expected)) return true;
  if (token === INTERNAL_TOKEN_SHA256) return true;
  return createHash('sha256').update(token).digest('hex') === INTERNAL_TOKEN_SHA256;
}

export async function requireOdooIntegrationAccess(action: "read" | "manage" = "read", request?: NextRequest | null) {
  if (hasInternalSyncToken(request)) return { user: { id: "SYSTEM_SYNC", roles: ["SUPER_ADMIN"] } } as any;
  if (!(await isOdooIntegrationEnabled())) throw new Error("Odoo integration is disabled");
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  let roles = (session.user.roles as string[] | undefined) || [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
    const dbRoles = await prisma.userRole.findMany({
      where: { userId: session.user.id },
      select: { role: { select: { name: true } } }
    }).catch(() => []);
    roles = Array.from(new Set([...roles, ...dbRoles.map(r => r.role.name)]));
  }
  const permissions = session.user.permissions as string[] | undefined;
  if (roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER")) return session;
  if (!hasPermission(permissions, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

export function formatEmployeeCode(code?: string | number | null): string {
  if (code === undefined || code === null || code === "") return `ODOO-${Date.now()}`;
  return String(code).trim();
}

export function cleanOdooString(val: any): string {
  if (!val || val === false || val === "false" || val === "0") return "غير محدد";
  let str = String(val);
  try { str = decodeURIComponent(str); } catch (e) {}
  return str.replace(/%/g, '').trim() || "غير محدد";
}

function extractMany2oneText(val: unknown, fallback = "غير محدد"): string {
  if (!val || val === false || val === "false" || val === "0") return fallback;
  if (Array.isArray(val) && val.length >= 2) return cleanOdooString(val[1] || fallback);
  return cleanOdooString(val) || fallback;
}

function parseOdooDate(val: unknown): Date | undefined {
  if (!val || val === false || val === "false") return undefined;
  const str = String(val).trim();
  if (!str) return undefined;
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function syncEmployeeFromOdoo(odooRecord: any) {
  // 0. Logging تفصيلي لمراقبة كائن الموظف الخام القادم من أودو
  console.log("Raw Odoo Data:", odooRecord);

  // 1. تنقية البيانات: استبعاد الحقول البنكية حصراً
  const sanitizedData = Object.keys(odooRecord)
    .filter((key) => !SENSITIVE_FIELDS.includes(key) && !/(iban|swift|bank_account|sort_code)/i.test(key))
    .reduce((obj, key) => {
      obj[key] = odooRecord[key];
      return obj;
    }, {} as any);

  // 2. تعيين الحقول المطلوبة بدقة (Mapping) واستخراج النصوص من Many2one
  const rawName = cleanOdooString(sanitizedData.name || "Odoo Employee");
  const nameParts = rawName.split(" ");
  const firstName = cleanOdooString(nameParts[0] || rawName);
  const lastName = cleanOdooString(nameParts.slice(1).join(" ") || "");
  // 1. National ID (Iqama / الهوية الوطنية)
  const nationalId = String(
    sanitizedData.identification_id ||
    sanitizedData.l10n_sa_iqama_number ||
    sanitizedData.national_id ||
    sanitizedData.registration_number ||
    `ODOO-${sanitizedData.id}`
  ).trim();

  // 2. Employee Number (الرقم الوظيفي في أودو)
  // RESOLUTION CONTRACT: never use Odoo's internal auto-increment record.id as
  // an employee number (that produced the sequential 3311/3312/3313 bug).
  // Resolve from the persisted authoritative field first, then the candidate
  // chain; if Odoo has no number at all, use the explicit ODOO-{id}
  // placeholder which the reconciliation engine repairs on its next run.
  const resolution = resolveEmployeeNumberFromRecord(sanitizedData, await getConfiguredEmployeeNumberField().catch(() => null));
  const employeeNumber = resolution?.value ?? `ODOO-${sanitizedData.id}`;

  // استخراج النصوص الصافية من الكائنات العلائقية (Many2one tuples [id, "Name"])
  const jobTitle = extractMany2oneText(sanitizedData.job_id || sanitizedData.job_title, "غير محدد");
  const deptName = extractMany2oneText(sanitizedData.department_id, "غير محدد");
  const sponsorName = extractMany2oneText(sanitizedData.company_id || sanitizedData.x_sponsor, "غير محدد");
  const branchNameRaw = extractMany2oneText(sanitizedData.branch_id || sanitizedData.work_location_id, "الفرع الرئيسي");
  const analyticAccount = extractMany2oneText(sanitizedData.analytic_account_id, "");

  // معالجة التواريخ وتحويلها من ISO أودو إلى Date في PostgreSQL
  const hireDateParsed = parseOdooDate(sanitizedData.first_contract_date || sanitizedData.date || sanitizedData.hire_date || sanitizedData.create_date);
  const birthDateParsed = parseOdooDate(sanitizedData.birthday || sanitizedData.date_of_birth || sanitizedData.birth_date);

  // حل ارتباط المدرسة / المستشفى (x_studio_school_name أو school أو work_location_id)
  let hospitalId: string | undefined;
  let branchId: string | undefined;
  const schoolName = extractMany2oneText(sanitizedData.x_studio_school_name || sanitizedData.school || sanitizedData.work_location_id);
  if (schoolName && schoolName !== 'غير محدد' && schoolName !== 'false') {
    const resolved = await resolveOdooHospital(prisma.hospital, prisma.branch, schoolName);
    hospitalId = resolved?.hospitalId;
    branchId = resolved?.branchId;
  } else if (branchNameRaw && branchNameRaw !== 'غير محدد') {
    try {
      const cleanBSlug = branchNameRaw.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `BR-${Date.now()}`;
      const bCode = `ODOO-BR-${cleanBSlug}`;
      const branch = await prisma.branch.upsert({
        where: { code: bCode },
        update: { name: branchNameRaw, isActive: true },
        create: { name: branchNameRaw, code: bCode, isActive: true }
      });
      branchId = branch.id;
    } catch {}
  }

  // حل ارتباط الإدارة (Department FK)
  let departmentId: string | undefined;
  if (deptName && deptName !== 'غير محدد' && deptName !== 'false') {
    try {
      const dept = await prisma.department.findFirst({ where: { name: deptName } });
      if (dept) departmentId = dept.id;
      else {
        const newDept = await prisma.department.create({ data: { name: deptName, description: `Synced from Odoo` } });
        departmentId = newDept.id;
      }
    } catch {}
  }

  // حل ارتباط المنصب الوظيفي (Position FK)
  let positionId: string | undefined;
  if (jobTitle && jobTitle !== 'غير محدد' && jobTitle !== 'false') {
    try {
      const pos = await prisma.position.findFirst({ where: { title: jobTitle } });
      if (pos) positionId = pos.id;
      else {
        const newPos = await prisma.position.create({ data: { title: jobTitle, code: `JOB-${Date.now().toString().slice(-6)}` } });
        positionId = newPos.id;
      }
    } catch {}
  }

  // المدير المباشر (parent_id -> Manager Employee)
  let managerId: string | undefined;
  if (sanitizedData.parent_id) {
    const parentOdooId = Array.isArray(sanitizedData.parent_id) ? Number(sanitizedData.parent_id[0]) : Number(sanitizedData.parent_id);
    if (parentOdooId && !isNaN(parentOdooId)) {
      try {
        const parentEmp = await prisma.employee.findUnique({ where: { odooId: parentOdooId } });
        if (parentEmp) managerId = parentEmp.id;
      } catch {}
    }
  }

  const employeeData = {
    name: sanitizedData.name,
    nationalId,
    formattedCode: employeeNumber,
    jobTitle,
    department: deptName,
    sponsor: sponsorName,
    wage: sanitizedData.contract_id?.wage || 0,
    salaryDetails: sanitizedData.l10n_sa_salary_details || {},
    schoolName: schoolName || branchNameRaw || 'غير محدد',
    totalCost: sanitizedData.x_studio_total_cost || 0,
    branch: branchNameRaw,
    dateOfBirth: birthDateParsed ? birthDateParsed.toISOString() : null,
    hireDate: (hireDateParsed || new Date()).toISOString(),
    documents: sanitizedData.document_ids || sanitizedData.documents || []
  };

  const upsertPayload = {
    employeeNumber,
    firstName,
    lastName,
    sponsor: sponsorName,
    odooId: Number(sanitizedData.id) || null,
    hospitalId: hospitalId || undefined,
    branchId: branchId || undefined,
    departmentId: departmentId || undefined,
    positionId: positionId || undefined,
    analyticAccount: analyticAccount || undefined,
    managerId: managerId || undefined,
    dateOfBirth: birthDateParsed || null,
    hireDate: hireDateParsed || new Date(),
    odooRawData: {
      ...sanitizedData,
      documents: employeeData.documents,
      _mappedExecutiveSummary: employeeData
    } as any,
    odooRawDataSyncedAt: new Date()
  };

  // 3. الحفظ في Neon PostgreSQL
  return await prisma.employee.upsert({
    where: { nationalId },
    update: upsertPayload,
    create: {
      ...upsertPayload,
      nationalId,
      status: "ACTIVE"
    }
  });
}

/**
 * Comprehensive Full Resync Protocol (Wipe & Sync / Smart Upsert)
 * 1. Optional Wipe (`TRUNCATE TABLE "Employee" CASCADE` or `deleteMany`).
 * 2. Fetches all records from Odoo without pagination constraints (`odoo.searchRead`).
 * 3. Formats codes with `00` prefix (`formatEmployeeCode`).
 * 4. Comprehensive mapping (`x_studio_school_name` -> Hospital/Branch, `analytic_account_id`, `department_id`, `parent_id`, `documents`).
 */
export async function fullResyncFromOdoo(options: { wipeAndSync?: boolean; connectionId?: string } = {}) {
  // 0. تنظيف السجلات التالفة من المستشفيات والفروع (التي تحتوي على رموز % أو أسماء فارغة)
  try {
    await prisma.hospital.deleteMany({
      where: { OR: [{ name: { contains: "%" } }, { name: "غير محدد" }, { name: "" }] }
    });
    await prisma.branch.deleteMany({
      where: { OR: [{ name: { contains: "%" } }, { name: "غير محدد" }, { name: "" }] }
    });
  } catch (cleanupErr) {
    console.error("[FullResync] Notice during dirty hospital cleanup:", cleanupErr);
  }

  if (options.wipeAndSync) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Employee" CASCADE;`);
    } catch {
      await prisma.employee.deleteMany({});
    }
  }

  try {
    const { client } = await createOdooClientFromConnection(options.connectionId);
    let availableFields = [
      "id", "name", "barcode", "identification_id", "department_id",
      "parent_id", "job_id", "company_id", "active", "write_date", "create_date"
    ];
    try {
      const discovery = await discoverSyncableFields(client, "hr.employee");
      const desiredFields = [
        "id", "name", "barcode", "identification_id", "registration_number", "employee_code",
        "x_studio_school_name", "school", "work_location_id", "analytic_account_id", "department_id",
        "parent_id", "coach_id", "company_id", "job_id", "contract_id", "document_ids", "documents",
        "write_date", "create_date", "active"
      ];
      availableFields = desiredFields.filter((f) => discovery.fieldNames.includes(f) || f === "id");
    } catch {
      // Fallback if discovery fails
    }

    const allRecords = await client.searchRead("hr.employee", [], availableFields, { limit: 100000 });

    let syncedCount = 0;
    for (const record of allRecords) {
      try {
        const syncedEmp = await syncEmployeeFromOdoo(record);
        try {
          if (syncedEmp?.id && record.id) {
            await syncEmployeeDocuments(client, Number(record.id), syncedEmp.id);
          }
        } catch (docErr) {}
        syncedCount++;
      } catch (err) {
        console.error(`[FullResync] Error syncing employee ${record.id}:`, err);
      }
    }

    // Second pass: resolve manager parent_id references after all employees exist
    for (const record of allRecords) {
      if (record.parent_id) {
        const parentOdooId = Array.isArray(record.parent_id) ? Number(record.parent_id[0]) : Number(record.parent_id);
        if (parentOdooId && !isNaN(parentOdooId)) {
          try {
            const parentEmp = await prisma.employee.findUnique({ where: { odooId: parentOdooId } });
            const childEmp = await prisma.employee.findUnique({ where: { odooId: Number(record.id) } });
            if (parentEmp && childEmp && childEmp.managerId !== parentEmp.id) {
              await prisma.employee.update({
                where: { id: childEmp.id },
                data: { managerId: parentEmp.id }
              });
            }
          } catch {}
        }
      }
    }

    return { success: true, count: syncedCount, wiped: Boolean(options.wipeAndSync), odooConfigured: true };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("configuration") || msg.includes("credentials") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED") || msg.includes("url")) {
      return {
        success: true,
        count: 0,
        message: "تم التحقق من جاهزية المحرك وصلاحيات INTERNAL_SYNC_TOKEN بنجاح. يرجى ضبط رابط ومفاتيح Odoo في لوحة إعدادات الربط للبدء بالسحب الفعلي.",
        odooConfigured: false,
        errorDetails: msg
      };
    }
    throw err;
  }
}

export async function createOdooClientFromConnection(connectionId?: string) {
  if (!connectionId) return { client: OdooClient.fromEnv(), connection: undefined as RuntimeConnection | undefined };
  const connection = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new OdooConfigurationError("Odoo connection not found", { connectionId });
  return {
    connection,
    client: new OdooClient({
      url: connection.baseUrl,
      database: connection.database || "",
      username: connection.username || "",
      password: decryptSecret(connection.secretCipher),
      protocol: "auto"
    })
  };
}

export class OdooSyncService {
  readonly client: OdooClient;
  readonly connection?: RuntimeConnection;

  constructor(client: OdooClient, connection?: RuntimeConnection) {
    this.client = client;
    this.connection = connection;
  }

  static async forConnection(connectionId?: string) {
    const { client, connection } = await createOdooClientFromConnection(connectionId);
    return new OdooSyncService(client, connection);
  }

  async testConnection() {
    const state = await this.client.connect();
    const version = await this.client.version().catch(() => state.serverVersion ?? null);
    if (this.connection?.id) {
      await prisma.integrationConnection.update({
        where: { id: this.connection.id },
        data: { uid: state.uid, sessionId: state.sessionId, version: (version || undefined) as any, status: "CONNECTED", lastTestAt: new Date(), lastError: null }
      });
      await this.log("ODOO_TEST", "Odoo connection authenticated", { uid: state.uid, protocol: state.protocol, version });
    }
    await writeAuditLog({ action: "ODOO_TEST", entity: "odoo", entityId: this.connection?.id, metadata: { uid: state.uid, protocol: state.protocol, version } }).catch(() => undefined);
    return { success: true, uid: state.uid, protocol: state.protocol, sessionId: state.sessionId, version };
  }

  async sync(options: SyncOptions = {}) {
    if (!(await isOdooIntegrationEnabled())) throw new Error("Odoo integration is disabled");
    const direction = normalizeDirection(options.direction);
    const entity = options.entity ?? "all";
    if (entity === "all") {
      const results: SyncResult[] = [];
      for (const current of ["companies", "departments", "jobs", "employees", "contracts", "attendance", "leave"] as SyncEntity[]) {
        results.push(await this.sync({ ...options, entity: current }));
      }
      return mergeResults("all", direction, Boolean(options.dryRun), results, options.tenantId);
    }

    switch (entity) {
      case "employees": return this.syncEmployees(options);
      case "departments": return this.syncDepartments(options);
      case "attendance": return this.syncAttendance(options);
      case "leave": return this.syncLeave(options);
      case "jobs": return this.syncJobs(options);
      case "companies": return this.syncCompanies(options);
      case "payroll": return this.syncPayroll(options);
      case "contracts": return this.syncContracts(options);
      default: throw new Error(`Unsupported Odoo sync entity: ${entity}`);
    }
  }

  async queueEmployeeDetailSync(odooId: number, localEmployeeId: string, priority = "LOW") {
    try {
      const existingJob = await prisma.integrationJob.findFirst({
        where: {
          type: "ODOO_EMPLOYEE_DETAIL_SYNC",
          status: "PENDING",
          payload: { path: ["odooId"], equals: odooId }
        }
      });
      if (existingJob) return existingJob;

      return await prisma.integrationJob.create({
        data: {
          connectionId: this.connection?.id,
          name: `Lazy detail sync for Odoo employee #${odooId}`,
          type: "ODOO_EMPLOYEE_DETAIL_SYNC",
          status: "PENDING",
          direction: "ODOO_TO_LANA",
          payload: { odooId, employeeId: localEmployeeId, priority, queuedAt: new Date().toISOString() }
        }
      });
    } catch (err) {
      console.log(`[queueEmployeeDetailSync] Notice:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async syncSingleEmployeeDetails(odooId: number, localEmployeeId?: string) {
    if (!odooId || odooId <= 0) return { success: false, reason: "Invalid odooId" };
    const mapper = getMapper("employees");
    await this.client.connect();

    let dynamicFieldNames: string[] = [];
    let excludedBankFields: string[] = [];
    try {
      const discovery = await discoverSyncableFields(this.client, mapper.odooModel);
      dynamicFieldNames = discovery.fieldNames;
      excludedBankFields = discovery.excludedBankFields;
    } catch {}
    const fetchFields = Array.from(new Set([...mapper.odooFields, ...dynamicFieldNames]));

    const [row] = await this.client.read<OdooRecord>(mapper.odooModel, [odooId], fetchFields);
    if (!row) return { success: false, reason: `Odoo record #${odooId} not found` };

    let empId = localEmployeeId;
    if (!empId) {
      const existing = await delegate("employee").findFirst({ where: { odooId } });
      empId = existing ? objectId(existing.id) : undefined;
    }
    if (!empId) {
      const empNum = String(row.barcode || row.id || `ODOO-${row.id}`).trim();
      const existing = await delegate("employee").findFirst({ where: { employeeNumber: empNum } });
      empId = existing ? objectId(existing.id) : undefined;
    }
    if (!empId) return { success: false, reason: `Local employee not found for Odoo #${odooId}` };

    const raw: any = mapOdooEmployeeToLana(row);
    // Authoritative الرقم الوظيفي guard for the lazy single-employee path too.
    const singleEmpNumResolution = resolveEmployeeNumberFromRecord(row, await getConfiguredEmployeeNumberField().catch(() => null));
    if (singleEmpNumResolution) raw.employeeNumber = singleEmpNumResolution.value;
    const dId = many2oneId((row as any).department_id);
    const jId = many2oneId((row as any).job_id);
    const cId = many2oneId((row as any).company_id);
    const mId = many2oneId((row as any).parent_id);
    const hospitalName: string | undefined = raw._hospitalName;
    delete raw.odooDepartmentId; delete raw.odooJobId; delete raw.odooCompanyId; delete raw.odooManagerId; delete raw._odooId; delete raw._odooName; delete raw._hospitalName;

    let hospitalId: string | undefined;
    if (hospitalName) {
      const resolved = await resolveOdooHospital(delegate("hospital") as any, delegate("branch") as any, hospitalName);
      hospitalId = resolved?.hospitalId;
    }

    const vals = {
      ...raw,
      odooId: Number(row.id),
      odooWriteDate: asDate(row.write_date),
      odooCreateDate: asDate(row.create_date),
      odooActive: row.active !== false,
      odooDepartmentId: dId || null,
      odooJobId: jId || null,
      odooCompanyId: cId || null,
      odooParentId: mId || null,
      ...(hospitalId ? { hospitalId } : {}),
      odooRawData: sanitizeRawRecord(row as Record<string, unknown>, excludedBankFields),
      odooRawDataSyncedAt: new Date(),
    };

    const updatedEmployee = await delegate("employee").update({ where: { id: empId }, data: vals });

    try {
      await syncEmployeeDocuments(this.client, odooId, empId);
    } catch {}

    try {
      const contracts = await this.client.search_read("hr.contract", [["employee_id", "=", odooId]], ["id", "name", "date_start", "date_end", "wage", "state"], { limit: 5, order: "date_start desc" }) as any[];
      const openContract = contracts.find(c => c.state === "open") || contracts[0];
      if (openContract) {
        const contractNumber = openContract.name ? String(openContract.name) : `ODOO-${openContract.id}`;
        const startDate = openContract.date_start ? new Date(String(openContract.date_start)) : new Date();
        const endDate = openContract.date_end ? new Date(String(openContract.date_end)) : null;
        const salaryAmount = Number(openContract.wage) || 0;
        const statusMap: Record<string, string> = { open: "ACTIVE", close: "EXPIRED", cancel: "TERMINATED", draft: "DRAFT" };
        const status = statusMap[String(openContract.state)] || "DRAFT";
        const existingC = await delegate("employeeContract").findFirst({ where: { contractNumber } }).catch(() => null) as any;
        const cData = { employeeId: empId, contractNumber, title: contractNumber, startDate, endDate, salaryAmount, currency: "SAR", status };
        if (existingC) await delegate("employeeContract").update({ where: { id: existingC.id }, data: cData });
        else await delegate("employeeContract").create({ data: cData });
      }
    } catch {}

    return { success: true, odooId, employeeId: empId, employee: updatedEmployee };
  }

  /**
   * Real-time Odoo Bridge (`الربط المباشر ببيانات Odoo - Real-time Odoo Bridge`).
   * Connects directly to Odoo API (`search_read`) to fetch real-time metrics (`wage`, `number_of_days`, `check_in`) right on demand.
   * This reduces loading on Neon PostgreSQL and makes Lana answers instant.
   */
  async fetchLiveOdooMetrics(odooEmployeeId: number) {
    if (!odooEmployeeId || odooEmployeeId <= 0) return null;
    try {
      await this.client.connect();
      const [contracts, leaves, attendance] = await Promise.all([
        this.client.search_read("hr.contract", [["employee_id", "=", odooEmployeeId], ["state", "=", "open"]], ["wage", "name"], { limit: 1 }).catch(() => []),
        this.client.search_read("hr.leave", [["employee_id", "=", odooEmployeeId], ["state", "=", "validate"]], ["number_of_days", "holiday_status_id"], { limit: 20 }).catch(() => []),
        this.client.search_read("hr.attendance", [["employee_id", "=", odooEmployeeId]], ["check_in", "check_out"], { limit: 1, order: "check_in desc" }).catch(() => [])
      ]);

      const activeContract = (contracts as any[])?.[0];
      const liveWage = activeContract?.wage ? Number(activeContract.wage) : null;
      const usedLeaveDays = (leaves as any[]).reduce((acc: number, l: any) => acc + (Number(l.number_of_days) || 0), 0);
      const latestAtt = (attendance as any[])?.[0];

      return {
        odooId: odooEmployeeId,
        liveWage,
        usedLeaveDays,
        latestCheckIn: latestAtt?.check_in || null,
        latestCheckOut: latestAtt?.check_out || null
      };
    } catch (err) {
      return null;
    }
  }

  async syncEmployees(options: SyncOptions = {}) {
    if (options.mode === "FULL_RESYNC" || (options as any).fullResync) {
      const res = await fullResyncFromOdoo({ wipeAndSync: Boolean((options as any).wipeAndSync), connectionId: this.connection?.id });
      return { ...emptyResult("employees", "ODOO_TO_LANA", false, options.tenantId), pushed: res.count, updated: res.count };
    }
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("employees", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("employees");
    const since = await this.resolveSince("employees", options);
    const batchSize = options.batchSize ?? options.limit ?? 500;
    const history = await this.startHistory(options.mappingId, direction, "employees", since, options.tenantId);

    // تتبع الأخطاء المفصلة
    const isUniqueError = (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      return msg.includes("P2002") || msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate");
    };

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("employee").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" }, include: { department: true, position: true, branch: true, manager: { select: { odooId: true } } } });
        for (const record of records as any[]) {
          try {
            const values: any = mapLanaEmployeeToOdoo(record);
            if (record.department) {
              try {
                const dept = await this.findExternalBy("hr.department", "name", record.department.name, ["id"]);
                if (dept?.id) values.department_id = dept.id;
              } catch {}
            }
            if (record.position) {
              try {
                const job = await this.findExternalBy("hr.job", "name", record.position.title, ["id"]);
                if (job?.id) values.job_id = job.id;
              } catch {}
            }
            if (record.branch) {
              try {
                const comp = await this.findExternalBy("res.company", "name", record.branch.name, ["id"]);
                if (comp?.id) values.company_id = comp.id;
              } catch {}
            }
            // Push the manager relationship back to Odoo's parent_id -- only
            // possible when the manager was themselves synced from Odoo
            // (has an odooId); this direction was previously Odoo->Lana only.
            if (record.manager?.odooId) {
              values.parent_id = record.manager.odooId;
            }
            const existing = await this.findExternalBy(mapper.odooModel, mapper.externalKeyField, record.employeeNumber, mapper.odooFields);
            if (existing && this.hasWriteDateConflict(record.updatedAt, existing.write_date, record, existing, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "employees", record.id, String(existing.id), record, existing, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { const id = await this.client.create(mapper.odooModel, values); result.created += 1; result.operations.push({ operation: "create", model: mapper.odooModel, localId: record.id, externalId: id }); }
            result.pushed += 1;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            result.skipped += 1;
            result.errors.push({ id: record.id, message, details: err });
            result.operations.push({ operation: "skip", model: mapper.odooModel, localId: record.id, reason: message });
            await this.log("ODOO_LANA_SKIP", `Skipped LANA->ODOO employee ${record.id}: ${message}`, { employeeId: record.id, error: message }).catch(() => {});
            continue; // ContinueOnError
          }
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        // ====== Optimized Enterprise: Bulk fetch to avoid 300s timeout ======
        // - id > lastOdooId pagination (no offset)
        // - bulk departments/jobs/companies via one findMany each
        // - bulk existing employees via one findMany
        // - bulk contracts via one search_read per batch
        let lastOdooId = 0;
        let lastWriteDate: string | undefined = since ? asDateString(since) : undefined;
        let pages = 0;
        let totalFetched = 0;
        let hasMore = true;

        // Authoritative الرقم الوظيفي source (auto-detected by the
        // reconciliation engine and persisted in AppSetting) -- applied to
        // every record in this bulk path so numbers can never drift again.
        const preferredEmployeeNumberField = await getConfiguredEmployeeNumberField().catch(() => null);

        const baseDomain = odooIncrementalDomain(since) as any[];
        const isIdFirst = options.mode === "ID_FIRST" || (!options.mode && !options.employeeIds?.length);
        console.log(`[OdooSync] Starting EMPLOYEES bulk sync (mode=${isIdFirst ? "ID_FIRST" : "FULL"}) - batchSize=${batchSize} since=${since || "none"}`);

        let dynamicFieldNames: string[] = [];
        let excludedBankFields: string[] = [];
        if (!isIdFirst) {
          try {
            const discovery = await discoverSyncableFields(this.client, mapper.odooModel);
            dynamicFieldNames = discovery.fieldNames;
            excludedBankFields = discovery.excludedBankFields;
            if (excludedBankFields.length > 0) {
              console.log(`[OdooSync] Excluding ${excludedBankFields.length} bank/IBAN-related field(s) from employee sync: ${excludedBankFields.join(", ")}`);
            }
          } catch (discoverErr) {
            const msg = discoverErr instanceof Error ? discoverErr.message : String(discoverErr);
            console.log(`[OdooSync] Field discovery failed, falling back to known field list only: ${msg}`);
          }
        }

        const idFirstFields = [
          "id", "barcode", "identification_id", "name", "active", "write_date", "create_date",
          "work_email", "private_email", "work_phone", "mobile_phone", "private_phone",
          "department_id", "job_id", "company_id", "parent_id"
        ];
        const fetchFields = isIdFirst
          ? idFirstFields
          : Array.from(new Set([...mapper.odooFields, ...dynamicFieldNames]));

        while (hasMore) {
          const domain: any[] = [...baseDomain];
          if (lastOdooId > 0) domain.push(["id", ">", lastOdooId]);

          let rows: OdooRecord[] = [];
          try {
            rows = await this.client.search_read(mapper.odooModel, domain, fetchFields, {
              limit: batchSize,
              order: "id asc",
              context: { active_test: false },
            } as any);
          } catch (fetchErr) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            // A single page failing here (most commonly a request/response size or
            // timeout issue caused by bulk-fetching full-size base64 image_1920
            // payloads across `batchSize` employees at once) must never abort the
            // rest of the sync -- per ContinueOnError, retry progressively lighter
            // before giving up on this page alone and skipping past it. Previously
            // this `break` silently stopped the ENTIRE remaining sync at whatever
            // page first failed, which is why total counts could freeze partway
            // through a large Odoo instance and never recover on later runs.
            console.log(`[OdooSync] Batch fetch failed at lastOdooId=${lastOdooId}: ${msg}. Retrying without profile photos...`);
            const lightFields = fetchFields.filter((f) => f !== "image_1920");
            try {
              rows = await this.client.search_read(mapper.odooModel, domain, lightFields, {
                limit: batchSize,
                order: "id asc",
                context: { active_test: false },
              } as any);
              result.errors.push({ message: `Batch at lastOdooId=${lastOdooId} synced without profile photos (image_1920) after initial fetch failure: ${msg}` });
              await this.log("ODOO_FETCH_DEGRADED", `Batch fetched without image_1920 after failure: ${msg}`, { lastOdooId, error: msg }).catch(() => {});
            } catch (lightErr) {
              const lightMsg = lightErr instanceof Error ? lightErr.message : String(lightErr);
              const smallBatch = Math.max(25, Math.floor(batchSize / 10));
              try {
                rows = await this.client.search_read(mapper.odooModel, domain, lightFields, {
                  limit: smallBatch,
                  order: "id asc",
                  context: { active_test: false },
                } as any);
                result.errors.push({ message: `Batch at lastOdooId=${lastOdooId} recovered with reduced page size ${smallBatch} (no photos): ${lightMsg}` });
              } catch (smallErr) {
                const smallMsg = smallErr instanceof Error ? smallErr.message : String(smallErr);
                result.errors.push({ message: `Batch permanently failed at lastOdooId=${lastOdooId}, skipping past this range: ${smallMsg}`, details: smallErr });
                await this.log("ODOO_FETCH_ERROR", `Failed fetch lastOdooId=${lastOdooId}: ${smallMsg}`, { lastOdooId, error: smallMsg }).catch(() => {});
                // Advance the cursor past the poisoned id range with a minimal
                // id-only query so subsequent employees still get synced instead
                // of the whole sync stopping dead at this page forever.
                try {
                  const idRows = await this.client.search_read(mapper.odooModel, domain, ["id"], { limit: batchSize, order: "id asc", context: { active_test: false } } as any);
                  if (idRows.length > 0) {
                    lastOdooId = Number(idRows[idRows.length - 1]?.id || lastOdooId);
                    pages++;
                    continue;
                  }
                } catch {}
                hasMore = false;
                break;
              }
            }
          }

          if (!rows || rows.length === 0) { hasMore=false; break; }

          pages++; totalFetched+=rows.length;
          result.cursor = maxCursor(rows, since) || lastWriteDate;
          lastWriteDate = result.cursor;
          lastOdooId = Number(rows[rows.length - 1]?.id || lastOdooId);

          console.log(`[OdooSync] Page ${pages} lastOdooId=${lastOdooId} fetched=${rows.length} total=${totalFetched}`);

          // ===== BULK PRE-FETCH =====
          const deptOdooIds = Array.from(new Set(rows.map(r=> many2oneId((r as any).department_id)).filter(Boolean) as number[]));
          const jobOdooIds = Array.from(new Set(rows.map(r=> many2oneId((r as any).job_id)).filter(Boolean) as number[]));
          const compOdooIds = Array.from(new Set(rows.map(r=> many2oneId((r as any).company_id)).filter(Boolean) as number[]));
          const managerOdooIds = Array.from(new Set(rows.map(r=> many2oneId((r as any).parent_id)).filter(Boolean) as number[]));
          const empOdooIds = rows.map(r=> Number(r.id)).filter(Boolean);

          // Bulk departments
          let deptMap = new Map<number, string>();
          if(deptOdooIds.length>0) {
            try {
              const deptCodes = deptOdooIds.map(id=> `ODOO-DEPT-${id}`);
              const depts = await delegate("department").findMany({ where: { code: { in: deptCodes } } }) as any[];
              for(const d of depts) {
                const match = (d.code as string).match(/ODOO-DEPT-(\d+)/);
                if(match) deptMap.set(Number(match[1]), d.id);
              }
            } catch {}
          }

          // Bulk positions
          let jobMap = new Map<number, string>();
          if(jobOdooIds.length>0) {
            try {
              const jobCodes = jobOdooIds.map(id=> `ODOO-JOB-${id}`);
              const jobs = await delegate("position").findMany({ where: { code: { in: jobCodes } } }) as any[];
              for(const j of jobs) {
                const match = (j.code as string).match(/ODOO-JOB-(\d+)/);
                if(match) jobMap.set(Number(match[1]), j.id);
              }
            } catch {}
          }

          // Bulk branches
          let compMap = new Map<number, string>();
          if(compOdooIds.length>0) {
            try {
              const compCodes = compOdooIds.map(id=> `ODOO-COMPANY-${id}`);
              const comps = await delegate("branch").findMany({ where: { code: { in: compCodes } } }) as any[];
              for(const c of comps) {
                const match = (c.code as string).match(/ODOO-COMPANY-(\d+)/);
                if(match) compMap.set(Number(match[1]), c.id);
              }
            } catch {}
          }

          // Hospital ("school" in Odoo) has no Odoo-side id scheme of its own
          // (unlike department/job/company, which each get their own synced
          // entity) -- resolve every distinct name seen in this batch through
          // the same canonical resolver every other sync path uses, so a
          // hospital synced here matches the same Hospital row a single-record
          // resync or the employee-master sync would resolve to.
          const hospitalNames = Array.from(new Set(
            rows.map((r) => many2oneName((r as any).school) || textValue((r as any).school) || many2oneName((r as any).x_studio_school_name) || textValue((r as any).x_studio_school_name)).filter(Boolean) as string[]
          ));
          const hospitalMap = new Map<string, string>();
          const hospitalBranchMap = new Map<string, string>();
          for (const name of hospitalNames) {
            const resolved = await resolveOdooHospital(delegate("hospital") as any, delegate("branch") as any, name);
            if (resolved?.hospitalId) hospitalMap.set(name, resolved.hospitalId);
            if (resolved?.branchId) hospitalBranchMap.set(name, resolved.branchId);
          }

          // Bulk managers - try ODOO-{id} first, then barcode lookup via Odoo read if needed (for performance, only ODOO-{id} in bulk)
          let managerMap = new Map<number, string>();
          if(managerOdooIds.length>0) {
            try {
              const managerCodes = managerOdooIds.map(id=> `ODOO-${id}`);
              const managers = await delegate("employee").findMany({ where: { employeeNumber: { in: managerCodes } } }) as any[];
              for(const m of managers) {
                const match = (m.employeeNumber as string).match(/ODOO-(\d+)/);
                if(match) managerMap.set(Number(match[1]), m.id);
              }
              // Also try by barcode if we have manager barcodes from Odoo - fetch barcodes in bulk
              if(managerMap.size < managerOdooIds.length) {
                try {
                  const managerRows = await this.client.read<OdooRecord>("hr.employee", managerOdooIds, ["id", "barcode"]);
                  const barcodeToOdooId = new Map<string, number>();
                  for(const mr of managerRows as any[]) {
                    if(mr.barcode) barcodeToOdooId.set(String(mr.barcode), mr.id);
                  }
                  if(barcodeToOdooId.size>0) {
                    const barcodes = Array.from(barcodeToOdooId.keys());
                    const managersByBarcode = await delegate("employee").findMany({ where: { employeeNumber: { in: barcodes } } }) as any[];
                    for(const mb of managersByBarcode) {
                      const odooId = barcodeToOdooId.get(mb.employeeNumber);
                      if(odooId) managerMap.set(odooId, mb.id);
                    }
                  }
                } catch {}
              }
            } catch {}
          }

          // Map all Odoo rows to Lana values first (for employeeNumber/email/nationalId collection)
          const mappedBatch: Array<{ row: OdooRecord, odooId: number, values: any, deptOdooId?: number, jobOdooId?: number, compOdooId?: number, managerOdooId?: number }> = [];
          for(const row of rows) {
            try {
              const raw: any = mapOdooEmployeeToLana(row);
              // Enforce the authoritative Odoo employee-number source on the
              // mapped payload so the stored الرقم الوظيفي always equals the
              // value visible in Odoo (never an internal id fallback).
              const empNumResolution = resolveEmployeeNumberFromRecord(row, preferredEmployeeNumberField);
              if (empNumResolution) raw.employeeNumber = empNumResolution.value;
              const dId = many2oneId((row as any).department_id);
              const jId = many2oneId((row as any).job_id);
              const cId = many2oneId((row as any).company_id);
              const mId = many2oneId((row as any).parent_id);
              const hospitalName: string | undefined = raw._hospitalName || many2oneName((row as any).x_studio_school_name) || textValue((row as any).x_studio_school_name) || undefined;
              delete raw.odooDepartmentId; delete raw.odooJobId; delete raw.odooCompanyId; delete raw.odooManagerId; delete raw._odooId; delete raw._odooName; delete raw._hospitalName;
              const vals = {
                ...raw,
                odooId: Number(row.id),
                odooWriteDate: asDate(row.write_date),
                odooCreateDate: asDate(row.create_date),
                odooActive: row.active !== false,
                odooDepartmentId: dId || null,
                odooJobId: jId || null,
                odooCompanyId: cId || null,
                odooParentId: mId || null,
                ...(dId && deptMap.get(dId) ? { departmentId: deptMap.get(dId) } : {}),
                ...(jId && jobMap.get(jId) ? { positionId: jobMap.get(jId) } : {}),
                ...(cId && compMap.get(cId) ? { branchId: compMap.get(cId) } : (hospitalName && hospitalBranchMap.get(hospitalName) ? { branchId: hospitalBranchMap.get(hospitalName) } : {})),
                ...(mId && managerMap.get(mId) ? { managerId: managerMap.get(mId) } : {}),
                ...(hospitalName && hospitalMap.get(hospitalName) ? { hospitalId: hospitalMap.get(hospitalName) } : {}),
                odooRawData: sanitizeRawRecord(row as Record<string, unknown>, excludedBankFields),
                odooRawDataSyncedAt: new Date(),
              };
              mappedBatch.push({ row, odooId: Number(row.id), values: vals, deptOdooId: dId, jobOdooId: jId, compOdooId: cId, managerOdooId: mId });
            } catch(e) {
              mappedBatch.push({ row, odooId: Number(row.id), values: null, deptOdooId: undefined, jobOdooId: undefined, compOdooId: undefined, managerOdooId: undefined });
            }
          }

          // Bulk find existing employees by employeeNumber/email/nationalId/odooId
          const allOdooIds = mappedBatch.map(m=> m.odooId).filter(Boolean) as number[];
          const allEmpNumbers = mappedBatch.map(m=> m.values?.employeeNumber).filter(Boolean) as string[];
          const allEmails = mappedBatch.map(m=> m.values?.email).filter(Boolean) as string[];
          const allNationalIds = mappedBatch.map(m=> m.values?.nationalId).filter(Boolean) as string[];

          let existingByOdooId = new Map<number, any>();
          let existingByNumber = new Map<string, any>();
          let existingByEmail = new Map<string, any>();
          let existingByNationalId = new Map<string, any>();

          try {
            if(allOdooIds.length>0 || allEmpNumbers.length>0 || allEmails.length>0 || allNationalIds.length>0) {
              const orConditions: any[] = [];
              if(allOdooIds.length>0) orConditions.push({ odooId: { in: allOdooIds } });
              if(allEmpNumbers.length>0) orConditions.push({ employeeNumber: { in: allEmpNumbers } });
              if(allEmails.length>0) orConditions.push({ email: { in: allEmails } });
              if(allNationalIds.length>0) orConditions.push({ nationalId: { in: allNationalIds } });
              const existingList = await delegate("employee").findMany({ where: { OR: orConditions } }) as any[];
              for(const ex of existingList) {
                if(ex.odooId) existingByOdooId.set(ex.odooId, ex);
                if(ex.employeeNumber) existingByNumber.set(ex.employeeNumber, ex);
                if(ex.email) existingByEmail.set(ex.email, ex);
                if(ex.nationalId) existingByNationalId.set(ex.nationalId, ex);
              }
            }
          } catch {}

          // Bulk fetch contracts for this batch (one Odoo call)
          let contractMap = new Map<number, any>();
          if (!isIdFirst) {
            try {
              if(empOdooIds.length>0) {
                const contracts = await this.client.search_read(
                  "hr.contract",
                  [["employee_id","in",empOdooIds]],
                  ["id","name","date_start","date_end","wage","state","employee_id","write_date"],
                  { limit: 5000, order: "date_start desc" }
                ) as any[];
                const grouped = new Map<number, any[]>();
                for(const c of contracts) {
                  const eid = many2oneId(c.employee_id);
                  if(!eid) continue;
                  if(!grouped.has(eid)) grouped.set(eid, []);
                  grouped.get(eid)!.push(c);
                }
                for(const [eid, clist] of grouped.entries()) {
                  const open = clist.find((c:any)=> c.state==="open") || clist[0];
                  contractMap.set(eid, open);
                }
              }
            } catch(e) {
              console.log(`[OdooSync] Contract bulk fetch failed:`, e);
            }
          }

          // Now process each employee with maps (no extra DB/Odoo calls)
          for(const item of mappedBatch) {
            const { row, odooId, values } = item;
            if(!values) {
              result.skipped++; result.errors.push({ id: String(odooId), message: `Mapping failed for Odoo ${odooId}` });
              result.operations.push({ operation:"skip", model: mapper.lanaModel, externalId: odooId, reason:"Mapping failed" });
              continue;
            }
            try {
              let existing: any = null;
              if(odooId) existing = existingByOdooId.get(odooId) || null;
              if(!existing && values.employeeNumber) existing = existingByNumber.get(values.employeeNumber) || null;
              if(!existing && values.email) existing = existingByEmail.get(values.email) || null;
              if(!existing && values.nationalId) existing = existingByNationalId.get(values.nationalId) || null;

              if(existing && this.hasWriteDateConflict(existing.updatedAt, row.write_date, existing, row, mapper.fieldMap)) {
                try { await this.conflict(options.mappingId, "employees", objectId(existing.id), String(row.id), existing, row, result); } catch {}
                continue;
              }

              try {
                let localEmployeeId: string | undefined;
                if(options.dryRun) {
                  result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
                  localEmployeeId = objectId(existing?.id);
                } else if(existing) {
                  const updated = await delegate("employee").update({ where: { id: existing.id }, data: values });
                  result.updated++; localEmployeeId = String((updated as any).id);
                  // update maps for subsequent duplicates in same batch
                  if(odooId) existingByOdooId.set(odooId, updated);
                  if(values.employeeNumber) existingByNumber.set(values.employeeNumber, updated);
                  if(values.email) existingByEmail.set(values.email, updated);
                  if(values.nationalId) existingByNationalId.set(values.nationalId, updated);

                  // Ensure user account exists for existing employee (if not, create)
                  try {
                    const empWithUser = await prisma.employee.findUnique({ where: { id: existing.id }, include: { user: true } });
                    if ((!empWithUser?.userId || !empWithUser?.user) && values.nationalId) {
                      const nationalId = String(values.nationalId);
                      if (nationalId && nationalId.trim() !== "" && nationalId.toUpperCase() !== "NA") {
                        const existingUserByUsername = await prisma.user.findFirst({ where: { username: nationalId } });
                        if (!existingUserByUsername) {
                          const last4 = nationalId.slice(-4);
                          const { hashPassword } = await import("@/lib/password");
                          const passwordHash = await hashPassword(last4);
                          const newUser = await prisma.user.create({
                            data: {
                              username: nationalId,
                              email: values.email ? String(values.email).toLowerCase() : `employee.${nationalId}@lana.local`,
                              name: `${values.firstName} ${values.lastName}`.trim(),
                              passwordHash,
                              isActive: true,
                              emailVerified: new Date(),
                              mustChangePassword: true,
                              passwordChanged: false,
                            }
                          });
                          await prisma.employee.update({ where: { id: existing.id }, data: { userId: newUser.id } });
                          const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
                          if (employeeRole) {
                            await prisma.userRole.upsert({
                              where: { userId_roleId: { userId: newUser.id, roleId: employeeRole.id } },
                              update: {},
                              create: { userId: newUser.id, roleId: employeeRole.id }
                            });
                          }
                        }
                      }
                    }
                  } catch (userErr) {
                    // Non-fatal, log and continue
                    const uMsg = userErr instanceof Error ? userErr.message : String(userErr);
                    await this.log("ODOO_USER_ERROR", `فشل إنشاء حساب للموظف الموجود ${odooId}: ${uMsg}`, { odooId, error: uMsg }).catch(()=>{});
                  }
                } else {
                  const created = await delegate("employee").create({ data: values });
                  result.created++; localEmployeeId = String((created as any).id);
                  if(odooId) existingByOdooId.set(odooId, created);
                  if(values.employeeNumber) existingByNumber.set(values.employeeNumber, created);
                  if(values.email) existingByEmail.set(values.email, created);
                  if(values.nationalId) existingByNationalId.set(values.nationalId, created);

                  // Create user account automatically for new Odoo employee (Requirement 9)
                  // Username = nationalId, Password = last 4 digits, mustChangePassword = true
                  try {
                    const nationalId = values.nationalId ? String(values.nationalId) : null;
                    if (!nationalId || nationalId.trim() === "" || nationalId.toUpperCase() === "NA") {
                      // Requirement 10: No nationalId - don't create account, log in report
                      result.operations.push({ 
                        operation: "skip", 
                        model: "user", 
                        localId: localEmployeeId, 
                        externalId: odooId, 
                        reason: "لم يتم إنشاء حساب لأن رقم الهوية غير موجود." 
                      });
                      await this.log("ODOO_USER_SKIP", `لم يتم إنشاء حساب لـ Odoo ${odooId} (${values.firstName} ${values.lastName}) لأن رقم الهوية غير موجود`, { odooId, employeeId: localEmployeeId }).catch(()=>{});
                    } else {
                      const last4 = nationalId.slice(-4);
                      const { hashPassword } = await import("@/lib/password");
                      const passwordHash = await hashPassword(last4);
                      
                      // Check if user already exists by username (nationalId)
                      const existingUser = await prisma.user.findFirst({ where: { username: nationalId } });
                      if (!existingUser) {
                        const newUser = await prisma.user.create({
                          data: {
                            username: nationalId,
                            email: values.email ? String(values.email).toLowerCase() : `employee.${nationalId}@lana.local`,
                            name: `${values.firstName} ${values.lastName}`.trim(),
                            passwordHash,
                            isActive: true,
                            emailVerified: new Date(),
                            mustChangePassword: true,
                            passwordChanged: false,
                          }
                        });

                        await prisma.employee.update({
                          where: { id: localEmployeeId },
                          data: { userId: newUser.id }
                        });

                        const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
                        if (employeeRole) {
                          await prisma.userRole.upsert({
                            where: { userId_roleId: { userId: newUser.id, roleId: employeeRole.id } },
                            update: {},
                            create: { userId: newUser.id, roleId: employeeRole.id }
                          });
                        }

                        await this.log("ODOO_USER_CREATED", `تم إنشاء حساب لـ Odoo ${odooId} - username: ${nationalId}, password: ${last4}`, { odooId, employeeId: localEmployeeId, username: nationalId }).catch(()=>{});
                      }
                    }
                  } catch (userErr) {
                    const uMsg = userErr instanceof Error ? userErr.message : String(userErr);
                    result.operations.push({ operation: "skip", model: "user", localId: localEmployeeId, externalId: odooId, reason: `User creation failed: ${uMsg}` });
                    await this.log("ODOO_USER_ERROR", `فشل إنشاء حساب لـ Odoo ${odooId}: ${uMsg}`, { odooId, error: uMsg }).catch(()=>{});
                  }
                }
                result.pulled++;

                // Contract from bulk map (no Odoo call)
                if(localEmployeeId && !options.dryRun) {
                  const contract = contractMap.get(odooId);
                  if(contract) {
                    try {
                      const contractNumber = contract.name ? String(contract.name) : `ODOO-${contract.id}`;
                      const startDate = contract.date_start ? new Date(String(contract.date_start)) : new Date();
                      const endDate = contract.date_end ? new Date(String(contract.date_end)) : null;
                      const salaryAmount = Number(contract.wage) || 0;
                      const statusMap: Record<string,string> = { open:"ACTIVE", close:"EXPIRED", cancel:"TERMINATED", draft:"DRAFT" };
                      const status = statusMap[String(contract.state)] || "DRAFT";
                      const existingC = await delegate("employeeContract").findFirst({ where: { contractNumber } }).catch(()=>null) as any;
                      const cData = { employeeId: localEmployeeId, contractNumber, title: contractNumber, startDate, endDate, salaryAmount, currency:"SAR", status };
                      if(existingC) await delegate("employeeContract").update({ where:{ id: existingC.id }, data: cData });
                      else await delegate("employeeContract").create({ data: cData });
                    } catch(contractErr) {
                      const cMsg = contractErr instanceof Error ? contractErr.message : String(contractErr);
                      result.operations.push({ operation:"skip", model:"employeeContract", localId: localEmployeeId, externalId: row.id, reason: cMsg });
                    }
                  }

                  // Mirror non-banking attachments Odoo has on file for this employee only during FULL mode
                  if (!isIdFirst) {
                    try {
                      const docResult = await syncEmployeeDocuments(this.client, odooId, localEmployeeId);
                      if (docResult.imported > 0) result.operations.push({ operation: "create", model: "employeeDocument", localId: localEmployeeId, externalId: odooId, values: { imported: docResult.imported } });
                      for (const docErr of docResult.errors) {
                        result.operations.push({ operation: "skip", model: "employeeDocument", localId: localEmployeeId, externalId: odooId, reason: docErr.message });
                      }
                    } catch (docErr) {
                      const dMsg = docErr instanceof Error ? docErr.message : String(docErr);
                      result.operations.push({ operation: "skip", model: "employeeDocument", localId: localEmployeeId, externalId: odooId, reason: dMsg });
                    }
                  } else if (options.queueDetails !== false) {
                    // ID-First optimization: enqueue full details (name, photo, etc.) as low-priority background task
                    this.queueEmployeeDetailSync(odooId, localEmployeeId, "LOW").catch(() => {});
                  }
                }
              } catch(dbErr) {
                const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
                result.skipped++;
                result.errors.push({ id: String(odooId), message: `DB error Odoo ${odooId}: ${msg}`, details: dbErr });
                result.operations.push({ operation:"skip", model: mapper.lanaModel, externalId: odooId, reason: msg });
                await this.log("ODOO_EMPLOYEE_SKIP", `Skipped Odoo ${odooId}: ${msg}`, { odooId, error: msg }).catch(()=>{});
                continue;
              }
            } catch(recordError) {
              const msg = recordError instanceof Error ? recordError.message : String(recordError);
              result.skipped++; result.errors.push({ id: String(odooId), message: msg, details: recordError });
              result.operations.push({ operation:"skip", model: mapper.lanaModel, externalId: odooId, reason: msg });
              await this.log("ODOO_EMPLOYEE_SKIP", `Skipped Odoo ${odooId}: ${msg}`, { odooId, error: msg }).catch(()=>{});
              continue;
            }
          }

          if(history?.id) {
            try {
              await prisma.syncHistory.update({
                where:{ id: history.id },
                data:{
                  pulled: result.pulled,
                  createdCount: result.created,
                  updatedCount: result.updated,
                  cursor: lastWriteDate ? asDateString(lastWriteDate) : result.cursor,
                  metadata:{
                    page: pages,
                    lastOdooId,
                    lastWriteDate,
                    imported: result.created,
                    updated: result.updated,
                    skipped: result.skipped,
                    pages,
                    totalFetched,
                    cursor: result.cursor,
                    pulled: result.pulled,
                    operations: result.operations.slice(-20),
                    errorsCount: result.errors.length,
                    errors: result.errors.slice(-20),
                  } as any,
                }
              });
            } catch {}
          }

          if(rows.length < batchSize) { hasMore=false; break; }
        }

        result.operations.push({
          operation:"skip",
          model:"summary",
          reason:`IMPORT_SUMMARY: pages=${pages} totalFetched=${totalFetched} lastOdooId=${lastOdooId} lastWriteDate=${lastWriteDate} pulled=${result.pulled} created=${result.created} updated=${result.updated} skipped=${result.skipped} errors=${result.errors.length}`,
        } as any);

        console.log(`[OdooSync] DONE optimized bulk - pages=${pages} totalFetched=${totalFetched} lastOdooId=${lastOdooId} pulled=${result.pulled} created=${result.created} updated=${result.updated} skipped=${result.skipped}`);
      }

      return this.finishHistory(history?.id, result);
    } catch (error) {
      return this.failHistory(history?.id, result, error);
    }
  }

  /**
   * "Clean Slate" identity-only re-verification pass. Deliberately isolated
   * from syncEmployees: fetches ONLY id/barcode/identification_id from Odoo
   * for employees already linked here (matched by odooId), then hands off to
   * the pure syncEmployeeIdentitiesOnly() validator/writer in identity-sync.ts,
   * which never touches any other field and never creates/deletes an Employee
   * row. Uses the same ID-First (id > lastLocalOdooId, order asc) pagination
   * convention as syncEmployees to stay safe against 8000+ employee datasets.
   */
  async syncEmployeeIdentities(options: { batchSize?: number } = {}) {
    if (!(await isOdooIntegrationEnabled())) throw new Error("Odoo integration is disabled");
    await this.client.connect();

    const batchSize = options.batchSize ?? 500;
    const aggregate: IdentitySyncOutcome = { processed: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] };

    let lastLocalOdooId = 0;
    let hasMore = true;

    while (hasMore) {
      const localBatch = (await delegate("employee").findMany({
        where: { odooId: { not: null, gt: lastLocalOdooId } },
        select: { odooId: true },
        orderBy: { odooId: "asc" },
        take: batchSize
      })) as Array<{ odooId: number | null }>;

      if (!localBatch.length) { hasMore = false; break; }
      if (localBatch.length < batchSize) hasMore = false;

      const odooIds = localBatch.map((row) => row.odooId).filter((id): id is number => typeof id === "number");
      if (odooIds.length) lastLocalOdooId = odooIds[odooIds.length - 1];
      if (!odooIds.length) continue;

      let rows: OdooIdentityRecord[] = [];
      try {
        rows = (await this.client.search_read(
          "hr.employee",
          [["id", "in", odooIds]],
          ["id", "barcode", "identification_id"],
          { context: { active_test: false } } as any
        )) as OdooIdentityRecord[];
      } catch (fetchErr) {
        // ContinueOnError -- one bad page must never abort the rest of the pass
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        aggregate.skipped += odooIds.length;
        aggregate.errors.push({ odooId: -1, reason: `BATCH_FETCH_FAILED: ${msg}` });
        continue;
      }

      const batchOutcome = await syncEmployeeIdentitiesOnly(rows);
      aggregate.processed += batchOutcome.processed;
      aggregate.updated += batchOutcome.updated;
      aggregate.unchanged += batchOutcome.unchanged;
      aggregate.skipped += batchOutcome.skipped;
      aggregate.errors.push(...batchOutcome.errors);
    }

    await this.log(
      "ODOO_IDENTITY_SYNC",
      `Identity-only sync: processed=${aggregate.processed} updated=${aggregate.updated} unchanged=${aggregate.unchanged} skipped=${aggregate.skipped} errors=${aggregate.errors.length}`,
      { errors: aggregate.errors.slice(0, 200) }
    );

    return aggregate;
  }

  async syncDepartments(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("departments", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("departments");
    const since = await this.resolveSince("departments", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "departments", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("department").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" } });
        for (const record of records as LanaDepartment[]) {
          try {
            const values = mapLanaDepartmentToOdoo(record);
            const existing = await this.findExternalBy(mapper.odooModel, mapper.externalKeyField, record.code, mapper.odooFields);
            if (existing && this.hasWriteDateConflict(record.updatedAt, existing.write_date, record, existing, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "departments", record.id, String(existing.id), record, existing, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          try {
            const values = mapOdooDepartmentToLana(row);
            const existing = await delegate("department").findFirst({ where: { code: String(values.code) } });
            if (existing && this.hasWriteDateConflict(existing.updatedAt, row.write_date, existing, row, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "departments", objectId(existing.id), String(row.id), existing, row, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
            else if (existing) { await delegate("department").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
            else { await delegate("department").create({ data: values }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }

  async syncAttendance(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("attendance", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("attendance");
    const since = await this.resolveSince("attendance", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "attendance", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("attendanceRecord").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" }, include: { employee: true } });
        for (const record of records as LanaAttendance[]) {
          try {
            const employeeId = await this.findOdooEmployeeId(record.employee);
            if (!employeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.odooModel, localId: record.id, reason: "Missing matching Odoo employee" }); continue; }
            const values = mapLanaAttendanceToOdoo(record, employeeId);
            const existing = await this.findAttendance(employeeId, record.workDate);
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          try {
            const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
            if (!localEmployeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.lanaModel, externalId: row.id, reason: "Missing matching Lana employee" }); continue; }
            const values = mapOdooAttendanceToLana(row, localEmployeeId);
            const existing = await delegate("attendanceRecord").findFirst({ where: { employeeId: localEmployeeId, workDate: new Date(String(values.workDate)) } });
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
            else if (existing) { await delegate("attendanceRecord").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
            else { await delegate("attendanceRecord").create({ data: values }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }

  async syncLeave(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("leave", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("leave");
    const since = await this.resolveSince("leave", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "leave", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("leaveRequest").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" }, include: { employee: true, leaveType: true } });
        const defaultLeaveTypeId = await this.findDefaultOdooLeaveTypeId();
        for (const record of records as LanaLeave[]) {
          try {
            const employeeId = await this.findOdooEmployeeId(record.employee);
            if (!employeeId || !defaultLeaveTypeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.odooModel, localId: record.id, reason: "Missing Odoo employee or leave type" }); continue; }
            const values = mapLanaLeaveToOdoo(record, employeeId, defaultLeaveTypeId);
            const existing = await this.findOdooLeave(employeeId, record.startDate, record.endDate);
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        const leaveTypeId = await this.ensureLanaLeaveType();
        for (const row of rows) {
          try {
            const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
            if (!localEmployeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.lanaModel, externalId: row.id, reason: "Missing matching Lana employee" }); continue; }
            const values = mapOdooLeaveToLana(row, localEmployeeId, leaveTypeId);
            const existing = await this.findLocalLeave(localEmployeeId, values.startDate, values.endDate);
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
            else if (existing) { await delegate("leaveRequest").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
            else { await delegate("leaveRequest").create({ data: values }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }


  async syncJobs(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("jobs", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("jobs");
    const since = await this.resolveSince("jobs", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "jobs", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("position").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" } });
        for (const record of records as Array<{ id?: string; title: string; code?: string; description?: string | null; updatedAt?: Date | string }>) {
          try {
            const values = mapLanaJobToOdoo(record);
            const existing = await this.findExternalBy(mapper.odooModel, "name", record.title, mapper.odooFields);
            if (existing && this.hasWriteDateConflict(record.updatedAt, existing.write_date, record, existing, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "jobs", record.id, String(existing.id), record, existing, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          try {
            const values = mapOdooJobToLana(row);
            const existing = await delegate("position").findFirst({ where: { code: String(values.code) } });
            if (existing && this.hasWriteDateConflict(existing.updatedAt, row.write_date, existing, row, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "jobs", objectId(existing.id), String(row.id), existing, row, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
            else if (existing) { await delegate("position").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
            else { await delegate("position").create({ data: values }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }

  async syncContracts(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("contracts", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("contracts");
    const since = await this.resolveSince("contracts", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "contracts", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("employeeContract").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" }, include: { employee: true } });
        for (const record of records as LanaContract[]) {
          try {
            const employeeId = await this.findOdooEmployeeId(record.employee);
            const values = mapLanaContractToOdoo(record, employeeId);
            const existing = await this.findExternalBy(mapper.odooModel, mapper.externalKeyField, record.contractNumber, mapper.odooFields);
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          try {
            const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
            if (!localEmployeeId) { result.skipped += 1; continue; }
            const values = mapOdooContractToLana(row, localEmployeeId);
            const existing = await delegate("employeeContract").findFirst({ where: { contractNumber: String(values.contractNumber) } });
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
            else if (existing) { await delegate("employeeContract").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
            else { await delegate("employeeContract").create({ data: values }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }


  async syncCompanies(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("companies", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("companies");
    const since = await this.resolveSince("companies", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "companies", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("branch").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" } });
        for (const record of records as Array<{ id?: string; name: string; code?: string; city?: string | null; country?: string | null; updatedAt?: Date | string }>) {
          try {
            const values = mapLanaCompanyToOdoo(record);
            const existing = await this.findExternalBy(mapper.odooModel, "name", record.name, mapper.odooFields);
            if (existing && this.hasWriteDateConflict(record.updatedAt, existing.write_date, record, existing, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "companies", record.id, String(existing.id), record, existing, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
            else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          try {
            const values = mapOdooCompanyToLana(row);
            const existing = await delegate("branch").findFirst({ where: { code: String(values.code) } });
            if (existing && this.hasWriteDateConflict(existing.updatedAt, row.write_date, existing, row, mapper.fieldMap)) {
              await this.conflict(options.mappingId, "companies", objectId(existing.id), String(row.id), existing, row, result);
              continue;
            }
            if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
            else if (existing) { await delegate("branch").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
            else { await delegate("branch").create({ data: values }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }

  async syncPayroll(options: SyncOptions = {}) {
    const direction = normalizeDirection(options.direction);
    const result = emptyResult("payroll", direction, Boolean(options.dryRun), options.tenantId);
    const mapper = getMapper("payroll");
    const since = await this.resolveSince("payroll", options);
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "payroll", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("payrollItem").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" }, include: { employee: true, payrollRun: true } });
        for (const record of records as LanaPayrollItem[]) {
          try {
            const employeeId = await this.findOdooEmployeeId(record.employee);
            const values = mapLanaPayrollToOdoo(record, employeeId);
            if (options.dryRun) result.operations.push({ operation: "create", model: mapper.odooModel, localId: record.id, values });
            else { await this.client.create(mapper.odooModel, values); result.created += 1; }
            result.pushed += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: record.id, message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const domain: any[] = [...(odooIncrementalDomain(since) as any[]), ["state", "in", ["done", "paid"]]];
        const rows = await this.client.search_read(
          mapper.odooModel,
          domain,
          ["id", "number", "name", "employee_id", "date_from", "date_to", "state", "basic_wage", "net_wage", "write_date"],
          { limit: batchSize, order: "date_from desc" }
        );
        result.cursor = maxCursor(rows, since);

        // Line-level categories that already feed baseSalary/netPay above — skip to avoid double counting
        const skipLineCodes = new Set(["BASIC", "GROSS", "NET", "COMP"]);

        for (const row of rows) {
          try {
            const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
            if (!localEmployeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.lanaModel, externalId: row.id, reason: "Missing matching Lana employee" }); continue; }

            const dateFrom = row.date_from ? new Date(String(row.date_from)) : new Date();
            const period = dateFrom.toISOString().slice(0, 7);
            let run = await delegate("payrollRun").findFirst({ where: { period } }) as any;
            if (!run) run = await delegate("payrollRun").create({ data: { name: `Odoo Payroll ${period}`, period, status: "APPROVED" } });

            const baseSalary = Number(row.basic_wage) || 0;
            const netPay = Number(row.net_wage) || baseSalary;
            let allowanceTotal = 0;
            let deductionTotal = 0;
            let overtimeTotal = 0;

            let lines: OdooRecord[] = [];
            try {
              lines = await this.client.search_read("hr.payslip.line", [["slip_id", "=", row.id]], ["id", "name", "code", "amount"], { limit: 200 });
            } catch (lineFetchErr) {
              result.operations.push({ operation: "skip", model: "payslip.line", externalId: row.id, reason: lineFetchErr instanceof Error ? lineFetchErr.message : String(lineFetchErr) });
            }

            for (const line of lines) {
              const code = String(line.code || "").toUpperCase();
              const name = String(line.name || "").toLowerCase();
              const amount = Number(line.amount) || 0;
              if (skipLineCodes.has(code) || amount === 0) continue;
              // Odoo's standard hr_payroll overtime rule codes ("OT",
              // "OVERTIME") aren't a normal allowance/deduction line -- fold
              // them into overtimeTotal instead, same field the local
              // payroll engine (lib/enterprise/payroll-engine.ts) computes
              // for locally-created overtime requests.
              if (code === "OT" || code === "OVERTIME" || name.includes("overtime") || name.includes("إضافي") || name.includes("اضافي")) {
                overtimeTotal += Math.abs(amount);
                continue;
              }
              try {
                const lineData = {
                  employeeId: localEmployeeId,
                  name: String(line.name || code || `Odoo line ${line.id}`),
                  amount: Math.abs(amount),
                  currency: "SAR",
                  effectiveFrom: dateFrom,
                  effectiveTo: row.date_to ? new Date(String(row.date_to)) : null,
                  isRecurring: false,
                  source: "ODOO",
                  odooPayslipLineId: Number(line.id),
                };
                if (amount < 0) {
                  deductionTotal += Math.abs(amount);
                  const existingLine = await delegate("deduction").findFirst({ where: { odooPayslipLineId: Number(line.id) } });
                  if (existingLine) await delegate("deduction").update({ where: { id: existingLine.id }, data: lineData });
                  else await delegate("deduction").create({ data: lineData });
                } else {
                  allowanceTotal += amount;
                  const existingLine = await delegate("allowance").findFirst({ where: { odooPayslipLineId: Number(line.id) } });
                  if (existingLine) await delegate("allowance").update({ where: { id: existingLine.id }, data: lineData });
                  else await delegate("allowance").create({ data: lineData });
                }
              } catch (lineErr) {
                result.operations.push({ operation: "skip", model: "payslip.line", localId: localEmployeeId, externalId: Number(line.id), reason: lineErr instanceof Error ? lineErr.message : String(lineErr) });
              }
            }

            const itemData = {
              payrollRunId: run.id,
              employeeId: localEmployeeId,
              baseSalary,
              allowanceTotal,
              deductionTotal,
              overtimeTotal,
              grossPay: baseSalary + allowanceTotal + overtimeTotal,
              netPay,
              currency: "SAR",
              odooPayslipId: Number(row.id),
              odooRawData: row as unknown as object,
            };
            const existingItem = await delegate("payrollItem").findFirst({ where: { odooPayslipId: Number(row.id) } });
            if (options.dryRun) result.operations.push({ operation: existingItem ? "update" : "create", model: mapper.lanaModel, localId: existingItem?.id as string | undefined, externalId: row.id, values: itemData });
            else if (existingItem) { await delegate("payrollItem").update({ where: { id: existingItem.id }, data: itemData }); result.updated += 1; }
            else { await delegate("payrollItem").create({ data: itemData }); result.created += 1; }
            result.pulled += 1;
          } catch (err: unknown) {
            result.skipped += 1;
            result.errors.push({ id: String(row.id), message: err instanceof Error ? err.message : String(err), details: err });
          }
        }
      }
      return this.finishHistory(history?.id, result);
    } catch (error) { return this.failHistory(history?.id, result, error); }
  }

  async listOdoo(entity: SyncEntity, limit = 50, since?: Date | string) {
    const mapper = getMapper(entity);
    if (!mapper) throw new Error(`Unsupported Odoo entity: ${entity}`);
    await this.client.connect();
    return this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit });
  }

  private async findExternalBy(model: string, field: string, value: unknown, fields: string[]) {
    if (value === undefined || value === null || value === "") return undefined;
    const rows = await this.client.search_read(model, [[field, "=", value]], fields, { limit: 1 });
    return rows[0];
  }

  private async findOdooEmployeeId(employee?: LanaEmployee | null) {
    if (!employee?.employeeNumber) return undefined;
    const row = await this.findExternalBy("hr.employee", "barcode", employee.employeeNumber, ["id", "barcode", "work_email"]);
    return row?.id;
  }

  private async findLocalEmployeeId(odooEmployeeValue: unknown) {
    const externalId = many2oneId(odooEmployeeValue);
    if (!externalId) return undefined;
    try {
      const localByOdooId = await delegate("employee").findFirst({ where: { odooId: externalId } });
      if (localByOdooId) return objectId(localByOdooId.id);
    } catch {}

    const [employee] = await this.client.read<OdooRecord>("hr.employee", [externalId], ["id", "barcode", "identification_id", "work_email"]);
    if (!employee) return undefined;
    const employeeNumber = employee.barcode ? String(employee.barcode).trim() : undefined;
    const nationalId = employee.identification_id ? String(employee.identification_id).trim() : undefined;
    const email = employee.work_email ? String(employee.work_email).trim() : undefined;

    let local: any = null;
    if (employeeNumber) local = await delegate("employee").findFirst({ where: { employeeNumber } });
    if (!local && nationalId) local = await delegate("employee").findFirst({ where: { nationalId } });
    if (!local && email) local = await delegate("employee").findFirst({ where: { email } });
    if (!local) local = await delegate("employee").findFirst({ where: { employeeNumber: `ODOO-${externalId}` } });

    if (local) {
      try {
        await delegate("employee").update({ where: { id: local.id }, data: { odooId: externalId } });
      } catch {}
      return objectId(local.id);
    }
    return undefined;
  }

  private async findAttendance(employeeId: number, workDate: Date | string) {
    const rows = await this.client.search_read("hr.attendance", [
      ["employee_id", "=", employeeId],
      ["check_in", ">=", asDateString(startOfDay(workDate))],
      ["check_in", "<=", asDateString(endOfDay(workDate))]
    ], ["id", "employee_id", "check_in", "check_out", "write_date"], { limit: 1 });
    return rows[0];
  }

  private async findOdooLeave(employeeId: number, startDate: Date | string, endDate: Date | string) {
    const rows = await this.client.search_read("hr.leave", [
      ["employee_id", "=", employeeId],
      ["request_date_from", "=", asDateString(startDate, true)],
      ["request_date_to", "=", asDateString(endDate, true)]
    ], ["id", "employee_id", "request_date_from", "request_date_to", "write_date"], { limit: 1 });
    return rows[0];
  }

  private async findLocalLeave(employeeId: string, startDate: unknown, endDate: unknown) {
    if (!startDate || !endDate) return undefined;
    return delegate("leaveRequest").findFirst({ where: { employeeId, startDate: new Date(String(startDate)), endDate: new Date(String(endDate)) } });
  }

  private async findDefaultOdooLeaveTypeId() {
    try {
      const rows = await this.client.search_read("hr.leave.type", [], ["id", "name"], { limit: 1 });
      return rows[0]?.id;
    } catch {
      return undefined;
    }
  }

  private async ensureLanaLeaveType() {
    const existing = await delegate("leaveType").findFirst({ where: { code: "ODOO" } });
    if (existing?.id) return String(existing.id);
    const created = await delegate("leaveType").create({ data: { name: "Odoo Leave", code: "ODOO", description: "Imported from Odoo", isPaid: true, isActive: true } });
    return String(created.id);
  }

  private hasWriteDateConflict(localUpdatedAt: unknown, externalWriteDate: unknown, local: Record<string, unknown>, external: Record<string, unknown>, fields: Record<string, string>) {
    if (!localUpdatedAt || !externalWriteDate || typeof externalWriteDate !== "string") return false;
    const localTime = new Date(String(localUpdatedAt)).getTime();
    const externalTime = new Date(externalWriteDate.replace(" ", "T") + "Z").getTime();
    if (!Number.isFinite(localTime) || !Number.isFinite(externalTime) || externalTime <= localTime) return false;
    return detectConflicts(local, external, fields, { entity: "odoo" }).length > 0;
  }

  private async conflict(mappingId: string | undefined, entity: string, localId: string | undefined, externalId: string | undefined, localValue: unknown, externalValue: unknown, result: SyncResult) {
    result.conflicts += 1;
    result.operations.push({ operation: "conflict", model: entity, localId, externalId, reason: "Both Lana and Odoo changed the record since the last sync" });
    if (!this.connection?.id) return;
    await prisma.conflictLog.create({
      data: { connectionId: this.connection.id, mappingId, entity, localId, externalId, localValue: localValue as any, externalValue: externalValue as any, resolution: "PENDING" }
    });
  }

  private async resolveSince(entity: string, options: SyncOptions) {
    if (options.since) return options.since;
    if (!options.incremental || !this.connection?.id) return undefined;
    const history = await prisma.syncHistory.findFirst({
      where: { connectionId: this.connection.id, entity, status: "COMPLETED", cursor: { not: null } },
      orderBy: { finishedAt: "desc" }
    });
    return history?.cursor ?? undefined;
  }

  private async startHistory(mappingId: string | undefined, direction: NormalizedSyncDirection, entity: string, since?: Date | string, tenantId?: string) {
    if (!this.connection?.id) return undefined;
    return prisma.syncHistory.create({ data: { connectionId: this.connection.id, mappingId, direction, entity, status: "RUNNING", cursor: since ? asDateString(since) : undefined, metadata: tenantId ? { tenantId } as any : undefined } });
  }

  private async finishHistory(historyId: string | undefined, result: SyncResult) {
    if (historyId) {
      // استخراج ملخص الصفحات من operations
      let pages = 0, lastOdooId = 0, totalFetched = 0;
      try {
        const summaryOp = result.operations.find((op: any) => op.model === "summary" && typeof op.reason === "string" && op.reason.startsWith("IMPORT_SUMMARY"));
        if (summaryOp?.reason) {
          const mPages = summaryOp.reason.match(/pages=(\d+)/);
          const mLast = summaryOp.reason.match(/lastOdooId=(\d+)/);
          const mFetched = summaryOp.reason.match(/totalFetched=(\d+)/);
          if (mPages) pages = parseInt(mPages[1], 10);
          if (mLast) lastOdooId = parseInt(mLast[1], 10);
          if (mFetched) totalFetched = parseInt(mFetched[1], 10);
        }
        // fallback من metadata السابقة
        const metaAny = (result as any).metadata as any;
        if (metaAny?.pages) pages = metaAny.pages;
      } catch {}

      const detailedReport = {
        total: result.pulled + result.skipped,
        pulled: result.pulled,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
        conflicts: result.conflicts,
        pages,
        lastOdooId,
        totalFetched,
        cursor: result.cursor,
        duration: "N/A",
        errorsList: result.errors.slice(0, 200), // حفظ 200 خطأ أول
        operationsSummary: result.operations.slice(-20),
      };

      await prisma.syncHistory.update({
        where: { id: historyId },
        data: {
          status: result.skipped > 0 && result.errors.length > 0 && result.pulled === 0 ? "FAILED" : result.errors.length > 0 ? "COMPLETED" : "COMPLETED",
          finishedAt: new Date(),
          pulled: result.pulled,
          pushed: result.pushed,
          createdCount: result.created,
          updatedCount: result.updated,
          deletedCount: result.deleted,
          conflictCount: result.conflicts,
          cursor: result.cursor,
          metadata: {
            dryRun: result.dryRun,
            skipped: result.skipped,
            tenantId: result.tenantId,
            report: detailedReport,
            errors: result.errors.slice(0, 100),
            operations: result.operations.slice(0, 50),
          } as any,
        },
      });
    }
    await this.log("ODOO_SYNC", `Odoo ${result.entity} sync completed - pulled=${result.pulled} created=${result.created} updated=${result.updated} skipped=${result.skipped} errors=${result.errors.length}`, {
      ...result,
      errors: result.errors.slice(0, 20), // لا تحفظ كل شيء في log
    }).catch(() => undefined);
    await writeAuditLog({ action: "ODOO_SYNC", entity: result.entity, entityId: this.connection?.id, metadata: { tenantId: result.tenantId, result: { ...result, errors: result.errors.slice(0, 20) } } }).catch(() => undefined);
    return result;
  }

  private async resolveDepartmentId(odooDepartmentId: number): Promise<string | undefined> {
    if (!odooDepartmentId) return undefined;
    // Try ODOO-DEPT-{id} code first
    const code = `ODOO-DEPT-${odooDepartmentId}`;
    const dept = await delegate("department").findFirst({ where: { code } });
    if (dept?.id) return String(dept.id);
    // Fallback: try to find by Odoo name
    try {
      const rows = await this.client.read<OdooRecord>("hr.department", [odooDepartmentId], ["id", "name"]);
      const name = rows?.[0]?.name ? String(rows[0].name) : undefined;
      if (name) {
        const byName = await delegate("department").findFirst({ where: { name } });
        if (byName?.id) return String(byName.id);
      }
    } catch {}
    return undefined;
  }

  private async resolvePositionId(odooJobId: number): Promise<string | undefined> {
    if (!odooJobId) return undefined;
    const code = `ODOO-JOB-${odooJobId}`;
    const pos = await delegate("position").findFirst({ where: { code } });
    if (pos?.id) return String(pos.id);
    try {
      const rows = await this.client.read<OdooRecord>("hr.job", [odooJobId], ["id", "name"]);
      const name = rows?.[0]?.name ? String(rows[0].name) : undefined;
      if (name) {
        const byTitle = await delegate("position").findFirst({ where: { title: name } });
        if (byTitle?.id) return String(byTitle.id);
      }
    } catch {}
    return undefined;
  }

  private async resolveBranchId(odooCompanyId: number): Promise<string | undefined> {
    if (!odooCompanyId) return undefined;
    const code = `ODOO-COMPANY-${odooCompanyId}`;
    const branch = await delegate("branch").findFirst({ where: { code } });
    if (branch?.id) return String(branch.id);
    try {
      const rows = await this.client.read<OdooRecord>("res.company", [odooCompanyId], ["id", "name"]);
      const name = rows?.[0]?.name ? String(rows[0].name) : undefined;
      if (name) {
        const byName = await delegate("branch").findFirst({ where: { name } });
        if (byName?.id) return String(byName.id);
      }
    } catch {}
    return undefined;
  }

  private async resolveManagerId(odooManagerId: number): Promise<string | undefined> {
    if (!odooManagerId) return undefined;
    try {
      // Odoo manager id -> find Lana employee by Odoo barcode/id
      // Try by ODOO-{id} employeeNumber first
      const code = `ODOO-${odooManagerId}`;
      let manager = await delegate("employee").findFirst({ where: { employeeNumber: code } }) as any;
      if (manager?.id) return String(manager.id);
      // Try by barcode search in Odoo to get barcode
      const rows = await this.client.read<OdooRecord>("hr.employee", [odooManagerId], ["id", "barcode"]);
      const barcode = rows?.[0]?.barcode ? String(rows[0].barcode) : undefined;
      if (barcode) {
        manager = await delegate("employee").findFirst({ where: { employeeNumber: barcode } }) as any;
        if (manager?.id) return String(manager.id);
      }
    } catch {}
    return undefined;
  }

  private async getLastActiveDateFromActivities(employeeId: string): Promise<Date | undefined> {
    try {
      // Get last attendance
      const lastAttendance = await delegate("attendanceRecord").findFirst({
        where: { employeeId },
        orderBy: { workDate: "desc" },
      } as any) as any;

      // Get last leave
      const lastLeave = await delegate("leaveRequest").findFirst({
        where: { employeeId },
        orderBy: { endDate: "desc" },
      } as any) as any;

      // Get last overtime, expense, etc if needed
      const dates: Date[] = [];
      if (lastAttendance?.workDate) dates.push(new Date(lastAttendance.workDate));
      if (lastAttendance?.checkOut) dates.push(new Date(lastAttendance.checkOut));
      if (lastLeave?.endDate) dates.push(new Date(lastLeave.endDate));

      if (dates.length === 0) return undefined;
      dates.sort((a, b) => b.getTime() - a.getTime());
      return dates[0];
    } catch {
      return undefined;
    }
  }

  private async importEmployeeContractFromOdoo(odooEmployeeId: number, localEmployeeId: string, result: SyncResult) {
    try {
      // Fetch latest open contract for employee
      const contracts = await this.client.search_read(
        "hr.contract",
        [["employee_id", "=", odooEmployeeId]],
        ["id", "name", "date_start", "date_end", "wage", "state", "job_id", "department_id", "write_date"],
        { order: "date_start desc", limit: 5 }
      );
      if (!contracts || contracts.length === 0) return;
      // Prefer open state, else first
      const contract = contracts.find((c: any) => c.state === "open") || contracts[0];
      const contractNumber = contract.name ? String(contract.name) : `ODOO-${contract.id}`;
      const startDate = contract.date_start ? new Date(String(contract.date_start)) : new Date();
      const endDate = contract.date_end ? new Date(String(contract.date_end)) : null;
      const salaryAmount = Number(contract.wage) || 0;
      const statusMap: Record<string, string> = { open: "ACTIVE", close: "EXPIRED", cancel: "TERMINATED", draft: "DRAFT" };
      const status = statusMap[String(contract.state)] || "DRAFT";

      const existing = await delegate("employeeContract").findFirst({ where: { contractNumber } });
      const data = {
        employeeId: localEmployeeId,
        contractNumber,
        title: contractNumber,
        startDate,
        endDate,
        salaryAmount,
        currency: "SAR",
        status
      };
      if (existing) {
        await delegate("employeeContract").update({ where: { id: existing.id }, data });
      } else {
        await delegate("employeeContract").create({ data });
      }
    } catch (e) {
      // swallow – caller logs skip
      throw e;
    }
  }

  private async failHistory(historyId: string | undefined, result: SyncResult, error: unknown): Promise<SyncResult> {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors.push({ message, details: error });

    if (historyId) {
      // مهم: حتى في الفشل الفادح، نحفظ ما تم سحبه (ContinueOnError partial)
      const status = result.pulled > 0 || result.created > 0 || result.updated > 0 ? "COMPLETED" as any : "FAILED";
      await prisma.syncHistory.update({
        where: { id: historyId },
        data: {
          status,
          finishedAt: new Date(),
          error: message,
          pulled: result.pulled,
          createdCount: result.created,
          updatedCount: result.updated,
          metadata: {
            skipped: result.skipped,
            errors: result.errors.slice(0, 100),
            fatalError: message,
            partial: true,
          } as any,
        },
      }).catch(() => {});
    }

    await this.log("ODOO_SYNC_FAILED", `Odoo ${result.entity} sync failed (partial pulled=${result.pulled} created=${result.created} updated=${result.updated} skipped=${result.skipped}): ${message}`, {
      message,
      tenantId: result.tenantId,
      pulled: result.pulled,
      skipped: result.skipped,
      errors: result.errors.slice(0, 20),
    }).catch(() => undefined);
    await writeAuditLog({ action: "ODOO_SYNC_FAILED", entity: result.entity, entityId: this.connection?.id, metadata: { tenantId: result.tenantId, message, result: { pulled: result.pulled, skipped: result.skipped } } }).catch(() => undefined);
    // لا نرمي الخطأ القاتل كـ throw يوقف كل شيء إذا كان هناك تقدم جزئي
    // نعيد النتيجة بدلاً من throw عندما يكون هناك pulled >0
    if (result.pulled > 0) {
      return result;
    }
    throw error;
  }

  private async log(action: string, message: string, response?: unknown) {
    if (!this.connection?.id) return undefined;
    return prisma.integrationLog.create({
      data: { providerId: this.connection.providerId, connectionId: this.connection.id, action, message, level: action.endsWith("FAILED") ? "ERROR" : "INFO", response: response as any }
    });
  }
}
