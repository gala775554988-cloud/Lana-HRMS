'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getHrmsModule, type HrmsModule, type ModuleField } from "@/config/hrms";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { applyScopedWhere, canAccessEmployeeId, getAccessProfile, getHierarchyStore } from "@/lib/enterprise/hierarchy";
import { writeAuditLog } from "@/lib/audit";
import { buildModuleSchema } from "@/lib/validations/hrms";
import { hashPassword } from "@/lib/password";
import { notifyRole } from "@/lib/enterprise/notifications";
import { extractSalaryProfile } from "@/lib/employee/salary-profile";
import { saveEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { requirePasswordChange } from "@/lib/auth/password-change-policy";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { getEmployeeIdsByHospital } from "@/lib/enterprise/hospitals";
import { withQueryTiming } from "@/lib/perf/query-timer";
import { getEmployeeFieldAccess, filterEditableFields } from "@/lib/enterprise/employee-field-access";

type QueryInput = {
  resourceKey: string;
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string | undefined>;
};

type MutationInput = {
  resourceKey: string;
  id?: string;
  values: Record<string, unknown>;
};

type CrudDelegate = {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  count(args: Record<string, unknown>): Promise<number>;
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
};

type CountDelegate = {
  count(args?: Record<string, unknown>): Promise<number>;
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
};

// Simple in-memory cache for counts (30s TTL) - performance improvement for 10000+ employees
const countCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_TTL = 30 * 1000;

function getCachedCount(key: string): number | null {
  const cached = countCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.count;
  }
  return null;
}

function setCachedCount(key: string, count: number) {
  countCache.set(key, { count, timestamp: Date.now() });
  // Clean old entries if cache grows too large
  if (countCache.size > 100) {
    const oldestKey = countCache.keys().next().value;
    if (oldestKey) countCache.delete(oldestKey);
  }
}

function delegateFor(modelName: string) {
  return (prisma as unknown as Record<string, CrudDelegate>)[modelName];
}

// Generic module list/edit views only ever read+write the columns declared in
// config/hrms.ts (tableFields for the list, fields for the create/edit form).
// Every other scalar column -- Odoo bookkeeping (odooId, odooRawData, ...),
// timestamps, etc. -- was still being fetched in full for every row because
// the generic delegate.findMany() call had no `select` at all. Building the
// select from that same config keeps it in sync automatically per module and
// can't blank the edit form the way a hand-picked tableFields-only select
// would (the edit form is pre-filled straight from this same list response).
function buildGenericModuleSelect(resource: HrmsModule): Record<string, true> | undefined {
  const names = new Set<string>(["id", ...resource.tableFields, ...resource.fields.map((field) => field.name)]);
  if (names.size === 0) return undefined;
  return Object.fromEntries(Array.from(names).map((name) => [name, true as const]));
}

function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    if ("toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function normalizeValue(field: ModuleField, value: unknown) {
  if (value === "" || value === undefined) return field.name === "profilePhotoUrl" ? null : undefined;
  if (field.type === "boolean") return Boolean(value);
  if (field.type === "number") return Number(value);
  if (field.type === "date") return new Date(String(value));
  if (field.name === "value" || field.name === "metadata") {
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
  }
  return value;
}

function normalizeValues(resource: HrmsModule, values: Record<string, unknown>) {
  return Object.fromEntries(
    resource.fields
      .map((field) => [field.name, normalizeValue(field, values[field.name])] as const)
      .filter(([, value]) => value !== undefined)
  );
}

function defaultEmployeePasswordFromNationalId(nationalId: string) {
  return nationalId.slice(-4).padStart(4, "0");
}

function positionCodeFromTitle(title: string) {
  return "POS-" + title.trim().toUpperCase().replace(/[^A-Z0-9\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

async function resolveEmployeePositionId(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) return undefined;
  const existing = await prisma.position.findUnique({ where: { id: title } }).catch(() => null);
  if (existing) return existing.id;
  const code = positionCodeFromTitle(title);
  const record = await prisma.position.upsert({
    where: { code },
    update: { title },
    create: { title, code, isActive: true }
  });
  return record.id;
}

async function requireModulePermission(resource: HrmsModule, action: "read" | "manage") {
  return withQueryTiming(`rbac.requireModulePermission(${resource.key}:${action})`, () => requireModulePermissionUntimed(resource, action));
}

async function requireModulePermissionUntimed(resource: HrmsModule, action: "read" | "manage") {
  const session = await auth();
  const requiredPermission = `${action}:${resource.permissionResource}`;
  if (!session?.user) {
    console.log("[RBAC][HRMS] denied", {
      module: resource.key,
      userId: null,
      username: null,
      roles: [],
      permissions: [],
      requiredPermission,
      reason: "Unauthorized: no session user"
    });
    throw new Error("Unauthorized");
  }

  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const username = await withQueryTiming("rbac.user.findUnique(usernameForLog)", () =>
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true } }).catch(() => null)
  );

  if (roles.includes("SUPER_ADMIN") || permissions.includes("*:*") || permissions.includes("SUPER_ADMIN")) {
    console.log("[RBAC][HRMS] allowed", {
      module: resource.key,
      userId: session.user.id,
      username: username?.username ?? username?.email ?? session.user.email ?? null,
      roles,
      permissions,
      requiredPermission,
      reason: "SUPER_ADMIN bypass"
    });
    return session;
  }

  if (!hasPermission(permissions, { action, resource: resource.permissionResource }, roles)) {
    console.log("[RBAC][HRMS] denied", {
      module: resource.key,
      userId: session.user.id,
      username: username?.username ?? username?.email ?? session.user.email ?? null,
      roles,
      permissions,
      requiredPermission,
      reason: "Missing permission in effective session permissions"
    });
    throw new Error("Forbidden");
  }
  if (!isEnterpriseResourceAllowed(roles, resource.permissionResource)) {
    console.log("[RBAC][HRMS] denied", {
      module: resource.key,
      userId: session.user.id,
      username: username?.username ?? username?.email ?? session.user.email ?? null,
      roles,
      permissions,
      requiredPermission,
      reason: "Role resource-access policy denied resource"
    });
    throw new Error("Forbidden");
  }
  console.log("[RBAC][HRMS] allowed", {
    module: resource.key,
    userId: session.user.id,
    username: username?.username ?? username?.email ?? session.user.email ?? null,
    roles,
    permissions,
    requiredPermission,
    reason: "Permission matched"
  });
  return session;
}

function buildWhere(resource: HrmsModule, search?: string, filters?: Record<string, string | undefined>) {
  const where: Record<string, unknown> = {};
  if (search && resource.searchFields.length > 0) {
    where.OR = resource.searchFields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } }));
  }
  for (const field of resource.filterFields) {
    const value = filters?.[field];
    if (value) where[field] = value === "true" ? true : value === "false" ? false : value;
  }
  return where;
}

async function assertRecordVisible(resource: HrmsModule, record: Record<string, unknown> | null, session: any) {
  if (!record) return;
  const roles = (session.user.roles as string[]) ?? [];
  if (roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER")) return;
  const profile = await getAccessProfile(session.user.id, roles);
  const employeeId = resource.key === "employees" ? String(record.id) : typeof record.employeeId === "string" ? record.employeeId : typeof record.assignedEmployeeId === "string" ? record.assignedEmployeeId : null;
  if (employeeId && !(await canAccessEmployeeId(employeeId, profile))) throw new Error("Forbidden");
}

export async function listModuleRecords(input: QueryInput) {
  const resource = getHrmsModule(input.resourceKey);
  if (!resource) throw new Error("Unknown module");

  // Check auth and permissions — but catch and return empty instead of throwing
  let session;
  try {
    session = await requireModulePermission(resource, "read");
  } catch (error: any) {
    // If unauthorized/forbidden, return empty result set instead of crashing the page
    if (error?.message === "Unauthorized" || error?.message === "Forbidden") {
      return {
        records: [] as Record<string, unknown>[],
        total: 0,
        page: Math.max(Number(input.page ?? 1), 1),
        pageSize: Math.min(Math.max(Number(input.pageSize ?? 30), 5), 200),
        pageCount: 1,
        error: error.message,
      };
    }
    throw error;
  }

  const page = Math.max(Number(input.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? 30), 5), 200);
  let baseWhere = buildWhere(resource, input.search, input.filters);

  if (resource.key === "employees") {
    const filters = input.filters ?? {};
    const employeeAnd: Record<string, unknown>[] = [];
    const relationContains = (relation: string, field: string, value?: string) => {
      if (value) employeeAnd.push({ [relation]: { [field]: { contains: value, mode: "insensitive" } } });
    };
    relationContains("department", "name", filters.department);
    relationContains("branch", "name", filters.branch);
    relationContains("position", "title", filters.position || filters.section);
    relationContains("employmentType", "name", filters.employmentType);
    relationContains("nationality", "name", filters.nationality);
    if (filters.hospital) {
      const employeeIds = await getEmployeeIdsByHospital(filters.hospital);
      employeeAnd.push({ id: { in: employeeIds.length ? employeeIds : ["__NO_HOSPITAL_MATCH__"] } });
    }
    if (filters.hireDate) {
      const start = new Date(filters.hireDate);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        employeeAnd.push({ hireDate: { gte: start, lt: end } });
      }
    }
    if (filters.manager) {
      const store = await getHierarchyStore();
      const manager = await prisma.employee.findFirst({
        where: {
          OR: [
            { employeeNumber: { equals: filters.manager, mode: "insensitive" } },
            { nationalId: { equals: filters.manager, mode: "insensitive" } },
            { firstName: { contains: filters.manager, mode: "insensitive" } },
            { lastName: { contains: filters.manager, mode: "insensitive" } }
          ]
        },
        select: { id: true }
      });
      if (manager) {
        const employeeIds = Object.entries(store.directManagers).filter(([, managerId]) => managerId === manager.id).map(([employeeId]) => employeeId);
        employeeAnd.push({ id: { in: employeeIds.length ? employeeIds : ["__NO_MANAGER_MATCH__"] } });
      }
    }
    if (filters.project) {
      const store = await getHierarchyStore();
      const employeeIds = Object.values(store.projects)
        .filter((project) => project.name.toLowerCase().includes(String(filters.project).toLowerCase()))
        .flatMap((project) => project.employeeIds);
      employeeAnd.push({ id: { in: employeeIds.length ? employeeIds : ["__NO_PROJECT_MATCH__"] } });
    }
    if (employeeAnd.length) baseWhere = Object.keys(baseWhere).length ? { AND: [baseWhere, ...employeeAnd] } : { AND: employeeAnd };
  }

  // Skip expensive hierarchy/profile queries for SUPER_ADMIN (no scope restrictions)
  const roles = (session.user.roles as string[]) ?? [];
  const accessProfile = roles.includes("SUPER_ADMIN")
    ? { isSuperAdmin: true, isHrManager: false, userId: session.user.id, roles, employee: null, store: {} as any }
    : await getAccessProfile(session.user.id, roles);
  const where = await applyScopedWhere(resource.key, baseWhere, accessProfile);

  // Special handling for employees: optimized with select + cache + performance
  if (resource.key === "employees") {
    try {
      // Cache key for count
      const cacheKey = JSON.stringify({ resource: resource.key, where, search: input.search, filters: input.filters });
      let total = getCachedCount(cacheKey);
      let records: any[];

      if (total === null) {
        // No cache, fetch both
        const [recs, cnt] = await Promise.all([
          prisma.employee.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              employeeNumber: true,
              nationalId: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              profilePhotoUrl: true,
              status: true,
              hireDate: true,
              createdAt: true,
              department: { select: { name: true, code: true } },
              position: { select: { title: true } },
              branch: { select: { name: true } },
              employmentType: { select: { name: true } },
              user: { select: { lastLoginAt: true } },
            },
          }),
          prisma.employee.count({ where }),
        ]);
        records = recs;
        total = cnt;
        setCachedCount(cacheKey, total);
      } else {
        // Use cached count, only fetch records
        records = await prisma.employee.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            employeeNumber: true,
            nationalId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePhotoUrl: true,
            status: true,
            hireDate: true,
            createdAt: true,
            department: { select: { name: true, code: true } },
            position: { select: { title: true } },
            branch: { select: { name: true } },
            employmentType: { select: { name: true } },
            user: { select: { lastLoginAt: true } },
          },
        });
      }

      const serializedRecords = records.map((r: any) => ({
        id: r.id,
        employeeNumber: r.employeeNumber,
        nationalId: r.nationalId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        // URL to the dedicated photo endpoint, not the raw base64 data URI --
        // see app/api/employees/[id]/photo/route.ts for why.
        profilePhotoUrl: r.profilePhotoUrl ? `/api/employees/${r.id}/photo` : null,
        status: r.status,
        hireDate: r.hireDate ? new Date(r.hireDate).toISOString().slice(0, 10) : null,
        department: r.department,
        position: r.position,
        branch: r.branch,
        employmentType: r.employmentType,
        lastLoginAt: r.user?.lastLoginAt ? new Date(r.user.lastLoginAt).toLocaleString("ar-SA") : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      }));

      return { records: serializedRecords as Record<string, unknown>[], total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) };
    } catch (error: any) {
      console.error(`[listModuleRecords] Prisma error for employees:`, error);
      return {
        records: [] as Record<string, unknown>[],
        total: 0,
        page,
        pageSize,
        pageCount: 1,
        error: error?.code === "P2021" ? "TABLE_NOT_FOUND" : "QUERY_FAILED",
      };
    }
  }

  // Generic module query with delegate
  try {
    const delegate = delegateFor(resource.model);
    if (!delegate) {
      console.error(`[listModuleRecords] No Prisma delegate for model: ${resource.model}`);
      return { records: [] as Record<string, unknown>[], total: 0, page, pageSize, pageCount: 1, error: "MODEL_NOT_FOUND" };
    }

    const findManyArgs: Record<string, unknown> = { where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" } };
    if (resource.key === "leave-requests") {
      findManyArgs.include = {
        employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        leaveType: { select: { name: true } }
      };
    } else {
      const select = buildGenericModuleSelect(resource);
      if (select) findManyArgs.select = select;
    }

    const [records, total] = await Promise.all([
      delegate.findMany(findManyArgs),
      delegate.count({ where })
    ]);

    const requestModules = new Set(["leave-requests", "overtime", "loans", "expenses", "letter-requests"]);
    if (requestModules.has(resource.key) && records.length > 0) {
      const ids = records.map((record) => String(record.id));
      const workflows = await prisma.workflowInstance.findMany({
        where: { entityId: { in: ids } },
        include: { steps: { orderBy: { step: "asc" } } }
      }).catch(() => []);
      const workflowByEntity = new Map(workflows.map((workflow) => [workflow.entityId, workflow]));
      const enriched = records.map((record) => {
        const workflow = workflowByEntity.get(String(record.id));
        const currentStep = workflow?.steps.find((step) => step.step === workflow.currentStep);
        return {
          ...record,
          _workflowId: workflow?.id,
          _workflowStatus: workflow?.status,
          _canAct: Boolean(currentStep?.approverUserId === session.user.id && currentStep.status === "PENDING")
        };
      });
      return { records: serialize(enriched) as Record<string, unknown>[], total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) };
    }

    return { records: serialize(records) as Record<string, unknown>[], total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) };
  } catch (error: any) {
    console.error(`[listModuleRecords] Query failed for ${resource.key}:`, error);
    return {
      records: [] as Record<string, unknown>[],
      total: 0,
      page,
      pageSize,
      pageCount: 1,
      error: error?.code === "P2021" ? "TABLE_NOT_FOUND" : "QUERY_FAILED",
    };
  }
}

export async function getModuleRecord(resourceKey: string, id: string) {
  const resource = getHrmsModule(resourceKey);
  if (!resource) throw new Error("Unknown module");
  const session = await requireModulePermission(resource, "read");
  try {
    let record: any;
    if (resourceKey === "employees") {
      record = await prisma.employee.findUnique({
        where: { id },
        include: {
          department: { select: { name: true } },
          position: { select: { title: true } },
          branch: { select: { name: true } },
          user: { select: { id: true, username: true, email: true, isActive: true, lastLoginAt: true, mustChangePassword: true, passwordChanged: true, passwordChangedAt: true, lastPasswordResetAt: true, lastPasswordResetBy: true } },
        },
      });
    } else {
      record = await delegateFor(resource.model).findUnique({ where: { id } });
    }
    await assertRecordVisible(resource, record, session);
    return serialize(record) as Record<string, unknown> | null;
  } catch (error: any) {
    console.error(`[getModuleRecord] Query failed for ${resourceKey}/${id}:`, error);
    return null;
  }
}

export async function createModuleRecord(input: MutationInput) {
  const resource = getHrmsModule(input.resourceKey);
  if (!resource) return { success: false, message: "Unknown module." };
  if (resource.key === "audit-logs") return { success: false, message: "Audit log entries are immutable and cannot be created manually." };
  const session = await requireModulePermission(resource, "manage");
  const salaryProfile = resource.key === "employees" ? extractSalaryProfile(input.values) : {};
  const parsed = buildModuleSchema(resource).safeParse(input.values);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = normalizeValues(resource, parsed.data) as Record<string, unknown>;
  const accessProfile = await getAccessProfile(session.user.id, (session.user.roles as string[]) ?? []);
  if (!accessProfile.isSuperAdmin && !accessProfile.isHrManager && typeof data.employeeId === "string" && !(await canAccessEmployeeId(data.employeeId, accessProfile))) {
    return { success: false, message: "Forbidden" };
  }

  // Auto-create User account for new employees
  if (resource.key === "employees" && resource.model === "employee") {
    try {
      const nationalId = String(data.nationalId ?? "");
      const firstName = String(data.firstName ?? "");
      const lastName = String(data.lastName ?? "");
      const emailInput = data.email ? String(data.email) : "";
      const fullName = `${firstName} ${lastName}`.trim() || "Employee";
      const employeeData = { ...data } as Record<string, unknown>;

      if (!nationalId) {
        return { success: false, message: "National ID is required to create login account." };
      }

      const existingEmployee = await prisma.employee.findUnique({
        where: { nationalId },
        include: { user: true }
      });
      if (existingEmployee?.userId) {
        return { success: false, message: "An account already exists for this National ID." };
      }

      const userEmail = emailInput && emailInput.includes("@")
        ? emailInput.toLowerCase()
        : `employee.${nationalId}@lana.local`;

      const emailUser = await prisma.user.findUnique({ where: { email: userEmail } }).catch(() => null);

      const defaultPassword = defaultEmployeePasswordFromNationalId(nationalId);
      const passwordHash = await hashPassword(defaultPassword);
      employeeData.positionId = await resolveEmployeePositionId(employeeData.positionId);

      const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });

      const result = await prisma.$transaction(async (tx: any) => {
        let user = emailUser;
        if (!user) {
          user = await tx.user.create({
            data: {
              name: fullName,
              email: userEmail,
              emailVerified: new Date(),
              passwordHash,
              isActive: true,
            }
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              name: fullName || user.name,
              passwordHash: user.passwordHash ?? passwordHash,
              isActive: true,
            }
          });
        }

        if (employeeRole && user) {
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
            update: {},
            create: { userId: user.id, roleId: employeeRole.id }
          });
        }

        if (!user) throw new Error("User creation failed");

        const employee = await tx.employee.create({
          data: {
            ...employeeData,
            userId: user.id,
          } as any
        });

        return { user, employee, usedPassword: defaultPassword };
      });

      await writeAuditLog({
        actorUserId: session.user.id,
        action: "create",
        entity: resource.model,
        entityId: String(result.employee.id),
        metadata: { before: null, after: serialize({ ...employeeData, autoUserCreated: true, userId: result.user.id }) }
      });

      await saveEmployeeSalaryProfile(String(result.employee.id), salaryProfile);
      await requirePasswordChange(String(result.user.id));
      revalidatePath("/" + resource.key);
      revalidatePath("/");
      await notifyRole(["SUPER_ADMIN", "HR_MANAGER"], "إضافة موظف", `Employee ${fullName} was added.`, "SUCCESS").catch(() => null);

      return {
        success: true,
        message: `${resource.title} record created. Login: National ID ${nationalId} / Password: ${result.usedPassword}`,
        id: String(result.employee.id)
      };
    } catch (error: any) {
      if (error?.code === "P2002") {
        return { success: false, message: "Employee with this National ID or Employee Number already exists, or user email already taken." };
      }
      console.error("Employee auto-user creation failed:", error);
    }
  }

  // Standard create for all other modules
  try {
    const record = await delegateFor(resource.model).create({ data });
    await writeAuditLog({ actorUserId: session.user.id, action: "create", entity: resource.model, entityId: String(record.id), metadata: { before: null, after: serialize(data) } });
    revalidatePath("/" + resource.key);
    revalidatePath("/");
    return { success: true, message: resource.title + " record created.", id: String(record.id) };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { success: false, message: "Record already exists – duplicate unique field." };
    }
    throw error;
  }
}

export async function updateModuleRecord(input: MutationInput) {
  const resource = getHrmsModule(input.resourceKey);
  if (!resource || !input.id) return { success: false, message: "Unknown record." };
  if (resource.key === "audit-logs") return { success: false, message: "Audit log entries are immutable and cannot be edited." };
  const session = await requireModulePermission(resource, "manage");
  const existingRecord = await delegateFor(resource.model).findUnique({ where: { id: input.id } });
  await assertRecordVisible(resource, existingRecord, session);
  const salaryProfile = resource.key === "employees" ? extractSalaryProfile(input.values) : {};
  const parsed = buildModuleSchema(resource).safeParse(input.values);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = normalizeValues(resource, parsed.data) as Record<string, unknown>;

  if (resource.key === "employees" && resource.model === "employee") {
    data.positionId = await resolveEmployeePositionId(data.positionId);
    // Real, server-side field-level enforcement: strip any sensitive field
    // (nationalId, email, phone, photo, address, emergency contact, DOB)
    // the acting user isn't explicitly granted EDIT on. This is the actual
    // security boundary -- the view-page redaction alone can't stop a
    // direct call to this action.
    const fieldAccess = await getEmployeeFieldAccess(session.user.id, (session.user.roles as string[]) ?? []);
    const { data: allowedData, blockedFields } = filterEditableFields(data, fieldAccess);
    const record = await delegateFor(resource.model).update({ where: { id: input.id }, data: allowedData });
    await saveEmployeeSalaryProfile(input.id, salaryProfile);

    await writeAuditLog({ actorUserId: session.user.id, action: "update", entity: resource.model, entityId: input.id, metadata: { before: serialize(existingRecord), after: serialize({ ...allowedData, salaryProfileUpdated: true }), blockedFields: blockedFields.length ? blockedFields : undefined } });
    await notifyRole(["SUPER_ADMIN", "HR_MANAGER"], "تعديل موظف", `Employee record ${input.id} was updated.`, "INFO").catch(() => null);
    revalidatePath("/" + resource.key);
    revalidatePath("/" + resource.key + "/" + input.id);
    return { success: true, message: resource.title + " record updated.", id: String(record.id) };
  }

  const dataClean = data;
  const record = await delegateFor(resource.model).update({ where: { id: input.id }, data: dataClean });
  await writeAuditLog({ actorUserId: session.user.id, action: "update", entity: resource.model, entityId: input.id, metadata: { before: serialize(existingRecord), after: serialize(dataClean) } });
  revalidatePath("/" + resource.key);
  revalidatePath("/" + resource.key + "/" + input.id);
  return { success: true, message: resource.title + " record updated.", id: String(record.id) };
}

export async function deleteModuleRecord(resourceKey: string, id: string) {
  const resource = getHrmsModule(resourceKey);
  if (!resource) return { success: false, message: "Unknown module." };
  if (resource.key === "audit-logs") return { success: false, message: "Audit log entries are immutable and cannot be deleted." };
  const session = await requireModulePermission(resource, "manage");
  const existingRecord = await delegateFor(resource.model).findUnique({ where: { id } });
  await assertRecordVisible(resource, existingRecord, session);
  await delegateFor(resource.model).delete({ where: { id } });
  await writeAuditLog({ actorUserId: session.user.id, action: "delete", entity: resource.model, entityId: id, metadata: { before: serialize(existingRecord), after: null } });
  revalidatePath("/" + resource.key);
  return { success: true, message: resource.title + " record deleted." };
}

export async function getDashboardMetrics() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const client = prisma as unknown as Record<string, CountDelegate>;

  const safeCount = async (fn: () => Promise<any>, fallback = 0) => {
    try {
      const result = await fn();
      return typeof result === "number" ? result : fallback;
    } catch {
      return fallback;
    }
  };

  const safeFindMany = async (fn: () => Promise<any>, fallback: any[] = []) => {
    try {
      const result = await fn();
      return Array.isArray(result) ? result : fallback;
    } catch {
      return fallback;
    }
  };

  const accessProfile = await getAccessProfile(session.user.id, (session.user.roles as string[]) ?? []);
  const employeeWhere = await applyScopedWhere("employees", {}, accessProfile);
  const leaveWhere = await applyScopedWhere("leave-requests", { status: "PENDING" }, accessProfile);

  const [employees, departments, openJobs, pendingLeave, unreadNotifications, auditLogs] = await Promise.all([
    safeCount(() => client.employee.count({ where: employeeWhere })),
    safeCount(() => client.department.count()),
    safeCount(() => client.jobOpening?.count?.({ where: { status: "OPEN" } }) ?? Promise.resolve(0)),
    safeCount(() => client.leaveRequest?.count?.({ where: leaveWhere }) ?? Promise.resolve(0)),
    safeCount(() => client.notification?.count?.({ where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null } }) ?? Promise.resolve(0)),
    safeFindMany(() => client.auditLog?.findMany?.({ take: 8, orderBy: { createdAt: "desc" } }) ?? Promise.resolve([]))
  ]);

  return serialize({ employees, departments, openJobs, pendingLeave, unreadNotifications, auditLogs }) as Record<string, unknown>;
}
