import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ensureEnterpriseRbacSeed } from "@/lib/enterprise/permissions";

export type HealthStatus = "OK" | "DEGRADED" | "ERROR" | "SKIPPED";

export type HealthItem = {
  key: string;
  label: string;
  status: HealthStatus;
  message: string;
  details?: Record<string, unknown>;
  checkedAt: string;
};

export type SystemHealthReport = {
  status: HealthStatus;
  checkedAt: string;
  version: string;
  items: HealthItem[];
  summary: {
    latestMigration: string | null;
    pendingMigrations: string[];
    userCount: number | null;
    employeeCount: number | null;
    lastSync: string | null;
  };
};

export const REQUIRED_USER_COLUMNS = [
  "id",
  "username",
  "email",
  "passwordHash",
  "isActive",
  "status",
  "lastLoginAt",
  "loginCount",
  "passwordChangedAt",
  "mustChangePassword",
  "isLocked",
  "lockedAt",
  "lockReason",
  "lockedReason",
  "lockedById",
  "loginAttempts",
  "failedLoginAttempts",
  "lastFailedLoginAt",
  "lockedUntil",
  "disabledAt",
] as const;

export const REQUIRED_RBAC_COLUMNS: Record<string, string[]> = {
  User: [...REQUIRED_USER_COLUMNS],
  Employee: ["id", "employeeNumber", "nationalId", "firstName", "lastName", "isPendingActivation", "pendingActivationUntil", "status"],
  Permission: ["id", "key", "action", "resource", "label", "groupId", "isSystem", "sortOrder"],
  PermissionGroup: ["id", "key", "name", "nameAr", "parentId", "isSystem", "sortOrder"],
  UserPermission: ["id", "userId", "permissionId", "effect", "assignedById", "expiresAt", "createdAt", "updatedAt"],
  AuditPermissionLog: ["id", "actorUserId", "targetUserId", "permissionId", "action", "oldValue", "newValue", "ipAddress", "userAgent", "device", "reason", "createdAt"],
};

function now() {
  return new Date().toISOString();
}

function item(key: string, label: string, status: HealthStatus, message: string, details?: Record<string, unknown>): HealthItem {
  return { key, label, status, message, details, checkedAt: now() };
}

function appVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

export function getExpectedMigrations() {
  try {
    const dir = path.join(process.cwd(), "prisma", "migrations");
    return fs.readdirSync(dir).filter((entry) => /^\d+_/.test(entry)).sort();
  } catch {
    return [];
  }
}

async function getAppliedMigrations() {
  const rows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY started_at ASC
  `;
  return rows;
}

async function getMissingColumns() {
  const result: Record<string, string[]> = {};
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_RBAC_COLUMNS)) {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
    `;
    const existing = new Set(rows.map((row) => row.column_name));
    const missing = requiredColumns.filter((column) => !existing.has(column));
    if (missing.length) result[tableName] = missing;
  }
  return result;
}

async function checkOdoo(): Promise<HealthItem> {
  const url = process.env.ODOO_URL;
  const database = process.env.ODOO_DATABASE;
  const username = process.env.ODOO_USERNAME;
  const password = process.env.ODOO_PASSWORD;
  if (!url || !database || !username || !password) {
    return item("odoo", "Odoo", "SKIPPED", "Odoo environment variables are not fully configured.", {
      hasUrl: Boolean(url), hasDatabase: Boolean(database), hasUsername: Boolean(username), hasPassword: Boolean(password),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const endpoint = `${url.replace(/\/$/, "")}/web/session/authenticate`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", params: { db: database, login: username, password } }),
      signal: controller.signal,
    });
    const ok = response.ok;
    return item("odoo", "Odoo", ok ? "OK" : "DEGRADED", ok ? "Odoo endpoint is reachable." : `Odoo responded with HTTP ${response.status}.`, { status: response.status });
  } catch (error) {
    return item("odoo", "Odoo", "DEGRADED", error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function getLastSync() {
  const db = prisma as any;
  const candidates = [
    async () => db.odooSyncLog?.findFirst?.({ orderBy: { createdAt: "desc" }, select: { createdAt: true, finishedAt: true, status: true } }),
    async () => db.integrationJob?.findFirst?.({ orderBy: { createdAt: "desc" }, select: { createdAt: true, completedAt: true, status: true } }),
  ];
  for (const candidate of candidates) {
    try {
      const row = await candidate();
      if (row) return (row.finishedAt ?? row.completedAt ?? row.createdAt)?.toISOString?.() ?? String(row.createdAt ?? "");
    } catch {
      // ignore optional model differences
    }
  }
  return null;
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const checkedAt = now();
  const items: HealthItem[] = [];
  let latestMigration: string | null = null;
  let pendingMigrations: string[] = [];
  let userCount: number | null = null;
  let employeeCount: number | null = null;
  let lastSync: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    items.push(item("database", "قاعدة البيانات", "OK", "Database connection is healthy."));
  } catch (error) {
    items.push(item("database", "قاعدة البيانات", "ERROR", error instanceof Error ? error.message : String(error)));
    return { status: "ERROR", checkedAt, version: appVersion(), items, summary: { latestMigration, pendingMigrations, userCount, employeeCount, lastSync } };
  }

  try {
    const appliedRows = await getAppliedMigrations();
    const applied = new Set(appliedRows.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
    const expected = getExpectedMigrations();
    pendingMigrations = expected.filter((migration) => !applied.has(migration));
    latestMigration = appliedRows.filter((row) => row.finished_at && !row.rolled_back_at).at(-1)?.migration_name ?? null;
    items.push(item("prisma", "Prisma / Migrations", pendingMigrations.length ? "ERROR" : "OK", pendingMigrations.length ? "There are unapplied migrations." : "All local Prisma migrations are applied.", { latestMigration, pendingMigrations }));
  } catch (error) {
    items.push(item("prisma", "Prisma / Migrations", "ERROR", error instanceof Error ? error.message : String(error)));
  }

  try {
    const missingColumns = await getMissingColumns();
    const hasMissing = Object.keys(missingColumns).length > 0;
    items.push(item("schema-columns", "الأعمدة المطلوبة", hasMissing ? "ERROR" : "OK", hasMissing ? "Required database columns are missing." : "Required RBAC/auth columns exist.", { missingColumns }));
  } catch (error) {
    items.push(item("schema-columns", "الأعمدة المطلوبة", "ERROR", error instanceof Error ? error.message : String(error)));
  }

  try {
    const [users, employees] = await Promise.all([
      prisma.user.count(),
      prisma.employee.count(),
    ]);
    userCount = users;
    employeeCount = employees;
    items.push(item("counts", "إحصائيات النظام", "OK", "User and employee counts loaded.", { userCount, employeeCount }));
  } catch (error) {
    items.push(item("counts", "إحصائيات النظام", "DEGRADED", error instanceof Error ? error.message : String(error)));
  }

  items.push(await checkOdoo());

  const hasRedis = Boolean(process.env.REDIS_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  items.push(item("redis", "Redis", hasRedis ? "OK" : "SKIPPED", hasRedis ? "Redis environment variables are configured." : "Redis is not configured."));

  const hasStorage = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  items.push(item("storage", "Storage", hasStorage ? "OK" : "DEGRADED", hasStorage ? "Supabase storage environment variables are configured." : "Supabase storage environment variables are incomplete."));

  lastSync = await getLastSync();

  const status: HealthStatus = items.some((healthItem) => healthItem.status === "ERROR")
    ? "ERROR"
    : items.some((healthItem) => healthItem.status === "DEGRADED")
      ? "DEGRADED"
      : "OK";

  return { status, checkedAt, version: appVersion(), items, summary: { latestMigration, pendingMigrations, userCount, employeeCount, lastSync } };
}

export async function repairSystemData(actorUserId?: string) {
  const actions: string[] = [];

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedReason" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedById" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "lockedReason" = COALESCE("lockedReason", "lockReason")`);
  actions.push("Verified account-lockout compatibility columns.");

  await ensureEnterpriseRbacSeed();
  actions.push("Repaired Enterprise RBAC roles, permissions, and role-permission links.");

  const passwordHash = await hashPassword("Admin@123456");
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: { isSystem: true, isEditable: false },
    create: { name: "SUPER_ADMIN", description: "Super Administrator", isSystem: true, isEditable: false },
    select: { id: true },
  });
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { email: "admin@lana.local", name: "System Administrator", isActive: true, status: "ACTIVE", isLocked: false, lockedAt: null, lockReason: null, lockedReason: null, passwordHash, emailVerified: new Date() },
    create: { username: "admin", email: "admin@lana.local", name: "System Administrator", isActive: true, status: "ACTIVE", isLocked: false, passwordHash, emailVerified: new Date() },
    select: { id: true, username: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });
  actions.push("Verified/recreated active SUPER_ADMIN account: admin / Admin@123456.");

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action: "system:repair",
      entity: "system",
      metadata: { actions },
    },
  }).catch(() => undefined);

  return { actions, report: await getSystemHealthReport() };
}
