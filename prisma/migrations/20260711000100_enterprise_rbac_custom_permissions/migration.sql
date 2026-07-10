-- Enterprise RBAC + per-user custom permissions
DO $$ BEGIN
  CREATE TYPE "PermissionEffect" AS ENUM ('GRANT','DENY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isEditable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "PermissionGroup" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "description" TEXT,
  "parentId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "Permission" SET "key" = "action" || ':' || "resource" WHERE "key" IS NULL;

CREATE TABLE IF NOT EXISTS "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL DEFAULT 'GRANT',
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditPermissionLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT NOT NULL,
  "permissionId" TEXT,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "device" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditPermissionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PermissionGroup_key_key" ON "PermissionGroup"("key");
CREATE INDEX IF NOT EXISTS "PermissionGroup_parentId_idx" ON "PermissionGroup"("parentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE INDEX IF NOT EXISTS "Permission_resource_idx" ON "Permission"("resource");
CREATE INDEX IF NOT EXISTS "Permission_groupId_idx" ON "Permission"("groupId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");
CREATE INDEX IF NOT EXISTS "UserPermission_userId_effect_idx" ON "UserPermission"("userId", "effect");
CREATE INDEX IF NOT EXISTS "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");
CREATE INDEX IF NOT EXISTS "UserPermission_expiresAt_idx" ON "UserPermission"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_actorUserId_idx" ON "AuditPermissionLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_targetUserId_idx" ON "AuditPermissionLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_permissionId_idx" ON "AuditPermissionLog"("permissionId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_createdAt_idx" ON "AuditPermissionLog"("createdAt");

DO $$ BEGIN
  ALTER TABLE "PermissionGroup" ADD CONSTRAINT "PermissionGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PermissionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Permission" ADD CONSTRAINT "Permission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditPermissionLog" ADD CONSTRAINT "AuditPermissionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditPermissionLog" ADD CONSTRAINT "AuditPermissionLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditPermissionLog" ADD CONSTRAINT "AuditPermissionLog_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
