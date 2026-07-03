'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getHrmsModule, type HrmsModule, type ModuleField } from "@/config/hrms";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { buildModuleSchema } from "@/lib/validations/hrms";

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

function delegateFor(modelName: string) {
  return (prisma as unknown as Record<string, CrudDelegate>)[modelName];
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
  if (value === "" || value === undefined) return undefined;
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

async function requireModulePermission(resource: HrmsModule, action: "read" | "manage") {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.permissions, { action, resource: resource.permissionResource })) {
    throw new Error("Forbidden");
  }
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

export async function listModuleRecords(input: QueryInput) {
  const resource = getHrmsModule(input.resourceKey);
  if (!resource) throw new Error("Unknown module");
  await requireModulePermission(resource, "read");

  const page = Math.max(Number(input.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? 10), 5), 100);
  const where = buildWhere(resource, input.search, input.filters);
  const delegate = delegateFor(resource.model);
  const [records, total] = await Promise.all([
    delegate.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" } }),
    delegate.count({ where })
  ]);

  return { records: serialize(records) as Record<string, unknown>[], total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getModuleRecord(resourceKey: string, id: string) {
  const resource = getHrmsModule(resourceKey);
  if (!resource) throw new Error("Unknown module");
  await requireModulePermission(resource, "read");
  const record = await delegateFor(resource.model).findUnique({ where: { id } });
  return serialize(record) as Record<string, unknown> | null;
}

export async function createModuleRecord(input: MutationInput) {
  const resource = getHrmsModule(input.resourceKey);
  if (!resource) return { success: false, message: "Unknown module." };
  const session = await requireModulePermission(resource, "manage");
  const parsed = buildModuleSchema(resource).safeParse(input.values);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = normalizeValues(resource, parsed.data);
  const record = await delegateFor(resource.model).create({ data });
  await writeAuditLog({ actorUserId: session.user.id, action: "create", entity: resource.model, entityId: String(record.id), metadata: data });
  revalidatePath("/" + resource.key);
  revalidatePath("/dashboard");
  return { success: true, message: resource.title + " record created.", id: String(record.id) };
}

export async function updateModuleRecord(input: MutationInput) {
  const resource = getHrmsModule(input.resourceKey);
  if (!resource || !input.id) return { success: false, message: "Unknown record." };
  const session = await requireModulePermission(resource, "manage");
  const parsed = buildModuleSchema(resource).safeParse(input.values);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = normalizeValues(resource, parsed.data);
  const record = await delegateFor(resource.model).update({ where: { id: input.id }, data });
  await writeAuditLog({ actorUserId: session.user.id, action: "update", entity: resource.model, entityId: input.id, metadata: data });
  revalidatePath("/" + resource.key);
  revalidatePath("/" + resource.key + "/" + input.id);
  return { success: true, message: resource.title + " record updated.", id: String(record.id) };
}

export async function deleteModuleRecord(resourceKey: string, id: string) {
  const resource = getHrmsModule(resourceKey);
  if (!resource) return { success: false, message: "Unknown module." };
  const session = await requireModulePermission(resource, "manage");
  await delegateFor(resource.model).delete({ where: { id } });
  await writeAuditLog({ actorUserId: session.user.id, action: "delete", entity: resource.model, entityId: id });
  revalidatePath("/" + resource.key);
  return { success: true, message: resource.title + " record deleted." };
}

export async function getDashboardMetrics() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const client = prisma as unknown as Record<string, CountDelegate>;
  const [employees, departments, openJobs, pendingLeave, unreadNotifications, auditLogs] = await Promise.all([
    client.employee.count(),
    client.department.count(),
    client.jobOpening.count({ where: { status: "OPEN" } }),
    client.leaveRequest.count({ where: { status: "PENDING" } }),
    client.notification.count({ where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null } }),
    client.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" } })
  ]);
  return serialize({ employees, departments, openJobs, pendingLeave, unreadNotifications, auditLogs }) as Record<string, unknown>;
}
