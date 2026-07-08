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
      for (const current of ["companies", "departments", "jobs", "employees", "attendance", "leave"] as SyncEntity[]) {
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
    const batchSize = options.batchSize ?? options.limit ?? 100;
    const history = await this.startHistory(options.mappingId, direction, "employees", since, options.tenantId);

    try {
      if (direction === "LANA_TO_ODOO" || direction === "BIDIRECTIONAL") {
        const records = await delegate("employee").findMany({ where: updatedWhere(since), take: batchSize, orderBy: { updatedAt: "asc" }, include: { department: true, position: true } });
        for (const record of records as LanaEmployee[]) {
          const values = mapLanaEmployeeToOdoo(record);
          const existing = await this.findExternalBy(mapper.odooModel, mapper.externalKeyField, record.employeeNumber, mapper.odooFields);
          if (existing && this.hasWriteDateConflict(record.updatedAt, existing.write_date, record, existing, mapper.fieldMap)) {
            await this.conflict(options.mappingId, "employees", record.id, String(existing.id), record, existing, result);
            continue;
          }
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
          else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
          else { const id = await this.client.create(mapper.odooModel, values); result.created += 1; result.operations.push({ operation: "create", model: mapper.odooModel, localId: record.id, externalId: id }); }
          result.pushed += 1;
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          const values = mapOdooEmployeeToLana(row);
          const employeeNumber = String(values.employeeNumber);
          const existing = await delegate("employee").findFirst({ where: { employeeNumber } });
          if (existing && this.hasWriteDateConflict(existing.updatedAt, row.write_date, existing, row, mapper.fieldMap)) {
            await this.conflict(options.mappingId, "employees", objectId(existing.id), String(row.id), existing, row, result);
            continue;
          }
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
          else if (existing) { await delegate("employee").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
          else { await delegate("employee").create({ data: values }); result.created += 1; }
          result.pulled += 1;
        }
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
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
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
          const employeeId = await this.findOdooEmployeeId(record.employee);
          if (!employeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.odooModel, localId: record.id, reason: "Missing matching Odoo employee" }); continue; }
          const values = mapLanaAttendanceToOdoo(record, employeeId);
          const existing = await this.findAttendance(employeeId, record.workDate);
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
          else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
          else { await this.client.create(mapper.odooModel, values); result.created += 1; }
          result.pushed += 1;
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
          if (!localEmployeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.lanaModel, externalId: row.id, reason: "Missing matching Lana employee" }); continue; }
          const values = mapOdooAttendanceToLana(row, localEmployeeId);
          const existing = await delegate("attendanceRecord").findFirst({ where: { employeeId: localEmployeeId, workDate: new Date(String(values.workDate)) } });
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
          else if (existing) { await delegate("attendanceRecord").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
          else { await delegate("attendanceRecord").create({ data: values }); result.created += 1; }
          result.pulled += 1;
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
          const employeeId = await this.findOdooEmployeeId(record.employee);
          if (!employeeId || !defaultLeaveTypeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.odooModel, localId: record.id, reason: "Missing Odoo employee or leave type" }); continue; }
          const values = mapLanaLeaveToOdoo(record, employeeId, defaultLeaveTypeId);
          const existing = await this.findOdooLeave(employeeId, record.startDate, record.endDate);
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
          else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
          else { await this.client.create(mapper.odooModel, values); result.created += 1; }
          result.pushed += 1;
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        const leaveTypeId = await this.ensureLanaLeaveType();
        for (const row of rows) {
          const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
          if (!localEmployeeId) { result.skipped += 1; result.operations.push({ operation: "skip", model: mapper.lanaModel, externalId: row.id, reason: "Missing matching Lana employee" }); continue; }
          const values = mapOdooLeaveToLana(row, localEmployeeId, leaveTypeId);
          const existing = await this.findLocalLeave(localEmployeeId, values.startDate, values.endDate);
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
          else if (existing) { await delegate("leaveRequest").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
          else { await delegate("leaveRequest").create({ data: values }); result.created += 1; }
          result.pulled += 1;
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
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
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
          const employeeId = await this.findOdooEmployeeId(record.employee);
          const values = mapLanaContractToOdoo(record, employeeId);
          const existing = await this.findExternalBy(mapper.odooModel, mapper.externalKeyField, record.contractNumber, mapper.odooFields);
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.odooModel, localId: record.id, externalId: existing?.id, values });
          else if (existing?.id) { await this.client.write(mapper.odooModel, [existing.id], values); result.updated += 1; }
          else { await this.client.create(mapper.odooModel, values); result.created += 1; }
          result.pushed += 1;
        }
      }
      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
          const localEmployeeId = await this.findLocalEmployeeId(row.employee_id);
          if (!localEmployeeId) { result.skipped += 1; continue; }
          const values = mapOdooContractToLana(row, localEmployeeId);
          const existing = await delegate("employeeContract").findFirst({ where: { contractNumber: String(values.contractNumber) } });
          if (options.dryRun) result.operations.push({ operation: existing ? "update" : "create", model: mapper.lanaModel, localId: objectId(existing?.id), externalId: row.id, values });
          else if (existing) { await delegate("employeeContract").update({ where: { id: existing.id }, data: values }); result.updated += 1; }
          else { await delegate("employeeContract").create({ data: values }); result.created += 1; }
          result.pulled += 1;
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
        }
      }

      if (direction === "ODOO_TO_LANA" || direction === "BIDIRECTIONAL") {
        const rows = await this.client.search_read(mapper.odooModel, odooIncrementalDomain(since), mapper.odooFields, { limit: batchSize, order: "write_date asc" });
        result.cursor = maxCursor(rows, since);
        for (const row of rows) {
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
          const employeeId = await this.findOdooEmployeeId(record.employee);
          const values = mapLanaPayrollToOdoo(record, employeeId);
          if (options.dryRun) result.operations.push({ operation: "create", model: mapper.odooModel, localId: record.id, values });
          else { await this.client.create(mapper.odooModel, values); result.created += 1; }
          result.pushed += 1;
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
      await prisma.syncHistory.update({
        where: { id: historyId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          pulled: result.pulled,
          pushed: result.pushed,
          createdCount: result.created,
          updatedCount: result.updated,
          deletedCount: result.deleted,
          conflictCount: result.conflicts,
          cursor: result.cursor,
          metadata: { dryRun: result.dryRun, skipped: result.skipped, tenantId: result.tenantId, operations: result.operations.slice(0, 50) } as any
        }
      });
    }
    await this.log("ODOO_SYNC", `Odoo ${result.entity} sync completed`, result).catch(() => undefined);
    await writeAuditLog({ action: "ODOO_SYNC", entity: result.entity, entityId: this.connection?.id, metadata: { tenantId: result.tenantId, result } }).catch(() => undefined);
    return result;
  }

  private async failHistory(historyId: string | undefined, result: SyncResult, error: unknown): Promise<SyncResult> {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors.push({ message, details: error });
    if (historyId) await prisma.syncHistory.update({ where: { id: historyId }, data: { status: "FAILED", finishedAt: new Date(), error: message } });
    await this.log("ODOO_SYNC_FAILED", `Odoo ${result.entity} sync failed`, { message, tenantId: result.tenantId }).catch(() => undefined);
    await writeAuditLog({ action: "ODOO_SYNC_FAILED", entity: result.entity, entityId: this.connection?.id, metadata: { tenantId: result.tenantId, message } }).catch(() => undefined);
    throw error;
  }

  private async log(action: string, message: string, response?: unknown) {
    if (!this.connection?.id) return undefined;
    return prisma.integrationLog.create({
      data: { providerId: this.connection.providerId, connectionId: this.connection.id, action, message, level: action.endsWith("FAILED") ? "ERROR" : "INFO", response: response as any }
    });
  }
}
