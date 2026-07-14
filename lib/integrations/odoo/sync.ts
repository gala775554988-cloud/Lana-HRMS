import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { decryptSecret } from "@/lib/integrations/security";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getOdooEnvConfig } from "./config";
import { OdooClient } from "./client";
import { OdooConfigurationError } from "./auth";
import {
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
  many2oneId
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

export async function requireOdooIntegrationAccess(action: "read" | "manage" = "read") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  const permissions = session.user.permissions as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(permissions, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
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

  async syncEmployees(options: SyncOptions = {}) {
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

        const baseDomain = odooIncrementalDomain(since) as any[];
        console.log(`[OdooSync] Starting EMPLOYEES optimized bulk - batchSize=${batchSize} since=${since || "none"}`);

        while (hasMore) {
          const domain: any[] = [...baseDomain];
          if (lastOdooId > 0) domain.push(["id", ">", lastOdooId]);

          let rows: OdooRecord[] = [];
          try {
            rows = await this.client.search_read(mapper.odooModel, domain, mapper.odooFields, {
              limit: batchSize,
              order: "id asc",
              context: { active_test: false },
            } as any);
          } catch (fetchErr) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            result.errors.push({ message: `Batch fetch failed at lastOdooId=${lastOdooId}: ${msg}`, details: fetchErr });
            await this.log("ODOO_FETCH_ERROR", `Failed fetch lastOdooId=${lastOdooId}: ${msg}`, { lastOdooId, error: msg }).catch(() => {});
            break;
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
              const dId = many2oneId((row as any).department_id);
              const jId = many2oneId((row as any).job_id);
              const cId = many2oneId((row as any).company_id);
              const mId = many2oneId((row as any).parent_id);
              delete raw.odooDepartmentId; delete raw.odooJobId; delete raw.odooCompanyId; delete raw.odooManagerId; delete raw._odooId; delete raw._odooName;
              const vals = {
                ...raw,
                ...(dId && deptMap.get(dId) ? { departmentId: deptMap.get(dId) } : {}),
                ...(jId && jobMap.get(jId) ? { positionId: jobMap.get(jId) } : {}),
                ...(cId && compMap.get(cId) ? { branchId: compMap.get(cId) } : {}),
                ...(mId && managerMap.get(mId) ? { managerId: managerMap.get(mId) } : {}),
              };
              mappedBatch.push({ row, odooId: Number(row.id), values: vals, deptOdooId: dId, jobOdooId: jId, compOdooId: cId, managerOdooId: mId });
            } catch(e) {
              mappedBatch.push({ row, odooId: Number(row.id), values: null, deptOdooId: undefined, jobOdooId: undefined, compOdooId: undefined, managerOdooId: undefined });
            }
          }

          // Bulk find existing employees by employeeNumber/email/nationalId
          const allEmpNumbers = mappedBatch.map(m=> m.values?.employeeNumber).filter(Boolean) as string[];
          const allEmails = mappedBatch.map(m=> m.values?.email).filter(Boolean) as string[];
          const allNationalIds = mappedBatch.map(m=> m.values?.nationalId).filter(Boolean) as string[];

          let existingByNumber = new Map<string, any>();
          let existingByEmail = new Map<string, any>();
          let existingByNationalId = new Map<string, any>();

          try {
            if(allEmpNumbers.length>0 || allEmails.length>0 || allNationalIds.length>0) {
              const orConditions: any[] = [];
              if(allEmpNumbers.length>0) orConditions.push({ employeeNumber: { in: allEmpNumbers } });
              if(allEmails.length>0) orConditions.push({ email: { in: allEmails } });
              if(allNationalIds.length>0) orConditions.push({ nationalId: { in: allNationalIds } });
              const existingList = await delegate("employee").findMany({ where: { OR: orConditions } }) as any[];
              for(const ex of existingList) {
                if(ex.employeeNumber) existingByNumber.set(ex.employeeNumber, ex);
                if(ex.email) existingByEmail.set(ex.email, ex);
                if(ex.nationalId) existingByNationalId.set(ex.nationalId, ex);
              }
            }
          } catch {}

          // Bulk fetch contracts for this batch (one Odoo call)
          let contractMap = new Map<number, any>();
          try {
            if(empOdooIds.length>0) {
              const contracts = await this.client.search_read(
                "hr.contract",
                [["employee_id","in",empOdooIds]],
                ["id","name","date_start","date_end","wage","state","employee_id","write_date"],
                { limit: 5000, order: "date_start desc" }
              ) as any[];
              // group by employee_id, prefer open
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
              if(values.employeeNumber) existing = existingByNumber.get(values.employeeNumber) || null;
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
        result.skipped += 1;
        result.operations.push({ operation: "skip", model: mapper.lanaModel, reason: "Payroll import requires project-specific payslip line salary rules; endpoint is enabled for Lana to Odoo export and dry-run validation." });
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
    const [employee] = await this.client.read<OdooRecord>("hr.employee", [externalId], ["id", "barcode", "identification_id", "work_email"]);
    const employeeNumber = employee?.barcode ? String(employee.barcode) : undefined;
    if (!employeeNumber) return undefined;
    const local = await delegate("employee").findFirst({ where: { employeeNumber } });
    return objectId(local?.id);
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
