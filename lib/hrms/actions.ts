'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getHrmsModule, type HrmsModule, type ModuleField } from "@/config/hrms";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { buildModuleSchema } from "@/lib/validations/hrms";
import { hashPassword } from "@/lib/password";

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
  const data = normalizeValues(resource, parsed.data) as Record<string, unknown>;

  // Auto-create User account for new employees
  if (resource.key === "employees" && resource.model === "employee") {
    try {
      const nationalId = String(data.nationalId ?? "");
      const firstName = String(data.firstName ?? "");
      const lastName = String(data.lastName ?? "");
      const emailInput = data.email ? String(data.email) : "";
      const fullName = `${firstName} ${lastName}`.trim() || "Employee";
      // password handling
      const inputPassword = typeof data.password === "string" && data.password.length >= 6 ? data.password : "";
      const inputPasswordConfirm = typeof (data as any).passwordConfirm === "string" ? (data as any).passwordConfirm : "";
      if (inputPassword && inputPassword !== inputPasswordConfirm) {
        return { success: false, message: "Password confirmation does not match." };
      }
      // strip password fields from employee data
      const { password, passwordConfirm, ...employeeData } = data as any;

      if (!nationalId) {
        return { success: false, message: "National ID is required to create login account." };
      }

      // Check if employee with this nationalId already has a user
      const existingEmployee = await prisma.employee.findUnique({
        where: { nationalId },
        include: { user: true }
      });
      if (existingEmployee?.userId) {
        return { success: false, message: "An account already exists for this National ID." };
      }

      // Check if user with this email already exists
      const userEmail = emailInput && emailInput.includes("@")
        ? emailInput.toLowerCase()
        : `employee.${nationalId}@lana.local`;

      // Actually check email uniquely
      const emailUser = await prisma.user.findUnique({ where: { email: userEmail } }).catch(() => null);

      // Default employee password: Emp@ + last 4 of nationalId, fallback Employee@123456
      const last4 = nationalId.slice(-4).padStart(4, "0");
      const defaultPassword = inputPassword || `Emp@${last4}` || "Employee@123456";
      const passwordHash = await hashPassword(defaultPassword);

      // Find EMPLOYEE role
      const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });

      // Create user + employee in transaction
      const result = await prisma.$transaction(async (tx: any) => {
        // Create or reuse user
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
          // Update existing user to ensure active + password set
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              name: fullName || user.name,
              passwordHash: inputPassword ? passwordHash : (user.passwordHash ?? passwordHash),
              isActive: true,
            }
          });
        }

        // Assign EMPLOYEE role
        if (employeeRole && user) {
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
            update: {},
            create: { userId: user.id, roleId: employeeRole.id }
          });
        }

        if (!user) throw new Error("User creation failed");

        // Create employee linked to user
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
        metadata: { ...employeeData, autoUserCreated: true, userId: result.user.id }
      });

      revalidatePath("/" + resource.key);
      revalidatePath("/");

      return {
        success: true,
        message: `${resource.title} record created. Login: National ID ${nationalId} / Password: ${result.usedPassword}`,
        id: String(result.employee.id)
      };
    } catch (error: any) {
      // Fallback to standard create if auto-user fails
      // Check for unique constraint errors
      if (error?.code === "P2002") {
        return { success: false, message: "Employee with this National ID or Employee Number already exists, or user email already taken." };
      }
      // Continue to standard flow below if specific handling fails
      console.error("Employee auto-user creation failed:", error);
    }
  }

  // Standard create for all other modules (and employee fallback)
  try {
    const record = await delegateFor(resource.model).create({ data });
    await writeAuditLog({ actorUserId: session.user.id, action: "create", entity: resource.model, entityId: String(record.id), metadata: data });
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
  const session = await requireModulePermission(resource, "manage");
  const parsed = buildModuleSchema(resource).safeParse(input.values);
  if (!parsed.success) return { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = normalizeValues(resource, parsed.data) as Record<string, unknown>;

  // Handle employee password update
  if (resource.key === "employees" && resource.model === "employee") {
    const inputPassword = typeof data.password === "string" ? data.password : "";
    const inputPasswordConfirm = typeof (data as any).passwordConfirm === "string" ? (data as any).passwordConfirm : "";
    if (inputPassword || inputPasswordConfirm) {
      if (inputPassword.length < 6) {
        return { success: false, message: "Password must be at least 6 characters." };
      }
      if (inputPassword !== inputPasswordConfirm) {
        return { success: false, message: "Password confirmation does not match." };
      }
    }
    // strip password fields
    delete (data as any).password;
    delete (data as any).passwordConfirm;

    // update employee record first
    const record = await delegateFor(resource.model).update({ where: { id: input.id }, data });

    // if password provided, update linked user
    if (inputPassword) {
      const employee = await prisma.employee.findUnique({ where: { id: input.id }, select: { userId: true } });
      if (employee?.userId) {
        const passwordHash = await hashPassword(inputPassword);
        await prisma.user.update({ where: { id: employee.userId }, data: { passwordHash } });
      }
    }

    await writeAuditLog({ actorUserId: session.user.id, action: "update", entity: resource.model, entityId: input.id, metadata: { ...data, passwordChanged: Boolean(inputPassword) } });
    revalidatePath("/" + resource.key);
    revalidatePath("/" + resource.key + "/" + input.id);
    return { success: true, message: resource.title + " record updated." + (inputPassword ? " Password updated." : ""), id: String(record.id) };
  }

  const dataClean = data;
  const record = await delegateFor(resource.model).update({ where: { id: input.id }, data: dataClean });
  await writeAuditLog({ actorUserId: session.user.id, action: "update", entity: resource.model, entityId: input.id, metadata: dataClean });
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

  const [employees, departments, openJobs, pendingLeave, unreadNotifications, auditLogs] = await Promise.all([
    safeCount(() => client.employee.count()),
    safeCount(() => client.department.count()),
    safeCount(() => client.jobOpening?.count?.({ where: { status: "OPEN" } }) ?? Promise.resolve(0)),
    safeCount(() => client.leaveRequest?.count?.({ where: { status: "PENDING" } }) ?? Promise.resolve(0)),
    safeCount(() => client.notification?.count?.({ where: { OR: [{ userId: session.user.id }, { userId: null }], readAt: null } }) ?? Promise.resolve(0)),
    safeFindMany(() => client.auditLog?.findMany?.({ take: 8, orderBy: { createdAt: "desc" } }) ?? Promise.resolve([]))
  ]);

  return serialize({ employees, departments, openJobs, pendingLeave, unreadNotifications, auditLogs }) as Record<string, unknown>;
}
