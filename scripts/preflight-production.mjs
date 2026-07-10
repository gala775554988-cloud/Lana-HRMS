import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const shouldRun = isVercel || process.env.CI_DB_PREFLIGHT === '1';
const databaseUrl = process.env.DATABASE_URL;

function fail(message, details) {
  console.error('\n❌ Production preflight failed');
  console.error(message);
  if (details) console.error(details);
  process.exit(1);
}

if (!shouldRun) {
  console.log('Skipping DB preflight outside Vercel/CI. Set CI_DB_PREFLIGHT=1 to force it.');
  process.exit(0);
}

if (!databaseUrl || databaseUrl.trim() === '') {
  fail('DATABASE_URL is missing or empty. Deployment is blocked to prevent runtime login failures.');
}

const requiredColumns = {
  User: ['id', 'username', 'email', 'passwordHash', 'isActive', 'status', 'lastLoginAt', 'loginCount', 'passwordChangedAt', 'mustChangePassword', 'isLocked', 'lockedAt', 'lockReason', 'lockedReason', 'lockedById', 'loginAttempts', 'failedLoginAttempts', 'lastFailedLoginAt', 'lockedUntil', 'disabledAt'],
  Employee: ['id', 'employeeNumber', 'nationalId', 'firstName', 'lastName', 'isPendingActivation', 'status'],
  Permission: ['id', 'key', 'action', 'resource', 'label', 'groupId', 'isSystem', 'sortOrder'], 
  PermissionGroup: ['id', 'key', 'name', 'nameAr', 'parentId', 'isSystem', 'sortOrder'],
  UserPermission: ['id', 'userId', 'permissionId', 'effect', 'assignedById', 'expiresAt', 'createdAt', 'updatedAt'],
  AuditPermissionLog: ['id', 'actorUserId', 'targetUserId', 'permissionId', 'action', 'oldValue', 'newValue', 'ipAddress', 'userAgent', 'device', 'reason', 'createdAt'],
};

function expectedMigrations() {
  const dir = path.join(process.cwd(), 'prisma', 'migrations');
  return fs.readdirSync(dir).filter((entry) => /^\d+_/.test(entry)).sort();
}

const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1`;

  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY started_at ASC
  `;
  const applied = new Set(migrations.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
  const pending = expectedMigrations().filter((migration) => !applied.has(migration));
  if (pending.length) {
    fail('There are Prisma migrations not applied to the target database.', `Pending migrations:\n${pending.map((m) => `- ${m}`).join('\n')}\n\nRun: npx prisma migrate deploy`);
  }

  const missingByTable = {};
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const rows = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tableName.replaceAll("'", "''")}'`);
    const existing = new Set(rows.map((row) => row.column_name));
    const missing = columns.filter((column) => !existing.has(column));
    if (missing.length) missingByTable[tableName] = missing;
  }
  if (Object.keys(missingByTable).length) {
    fail('Required database columns are missing. Deployment is blocked to prevent auth/RBAC runtime failures.', JSON.stringify(missingByTable, null, 2));
  }

  console.log('✅ Production preflight passed: database reachable, migrations applied, required columns exist.');
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await prisma.$disconnect();
}
