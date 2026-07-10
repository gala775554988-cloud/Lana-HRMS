DO $$ BEGIN
  CREATE TYPE "PermissionEffect" AS ENUM ('GRANT','DENY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User/account columns required by the application
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isEditable" BOOLEAN NOT NULL DEFAULT true;

-- Normalize previous PermissionGroup shape to the new Enterprise RBAC shape
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT true;
UPDATE "PermissionGroup" SET "key" = COALESCE("key", "code", "id") WHERE "key" IS NULL;
ALTER TABLE "PermissionGroup" ALTER COLUMN "key" SET NOT NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='PermissionGroup' AND column_name='code') THEN
    ALTER TABLE "PermissionGroup" ALTER COLUMN "code" DROP NOT NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "PermissionGroup_key_key" ON "PermissionGroup"("key");
CREATE INDEX IF NOT EXISTS "PermissionGroup_parentId_idx" ON "PermissionGroup"("parentId");
DO $$ BEGIN
  ALTER TABLE "PermissionGroup" ADD CONSTRAINT "PermissionGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PermissionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Permission additions required by Prisma schema and RBAC APIs
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "Permission" SET "key" = "action" || ':' || "resource" WHERE "key" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Permission' AND column_name='groupCode') THEN
    UPDATE "Permission" p
    SET "groupId" = pg."id"
    FROM "PermissionGroup" pg
    WHERE p."groupId" IS NULL AND p."groupCode" IS NOT NULL AND (pg."key" = p."groupCode" OR pg."code" = p."groupCode");
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE INDEX IF NOT EXISTS "Permission_resource_idx" ON "Permission"("resource");
CREATE INDEX IF NOT EXISTS "Permission_groupId_idx" ON "Permission"("groupId");
DO $$ BEGIN
  ALTER TABLE "Permission" ADD CONSTRAINT "Permission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UserPermission: preserve previous isGranted/grantedById/grantedAt while adding Grant/Deny model
ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "effect" "PermissionEffect" NOT NULL DEFAULT 'GRANT';
ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "assignedById" TEXT;
ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserPermission" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "UserPermission" SET "effect" = CASE WHEN "isGranted" = false THEN 'DENY'::"PermissionEffect" ELSE 'GRANT'::"PermissionEffect" END;
UPDATE "UserPermission" SET "assignedById" = COALESCE("assignedById", "grantedById");
UPDATE "UserPermission" SET "createdAt" = COALESCE("createdAt", "grantedAt", CURRENT_TIMESTAMP);
DELETE FROM "UserPermission" a
USING "UserPermission" b
WHERE a.ctid < b.ctid AND a."userId" = b."userId" AND a."permissionId" = b."permissionId";
CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");
CREATE INDEX IF NOT EXISTS "UserPermission_userId_effect_idx" ON "UserPermission"("userId", "effect");
CREATE INDEX IF NOT EXISTS "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");
CREATE INDEX IF NOT EXISTS "UserPermission_expiresAt_idx" ON "UserPermission"("expiresAt");
DO $$ BEGIN
  ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AuditPermissionLog additions used by API audit trail
ALTER TABLE "AuditPermissionLog" ADD COLUMN IF NOT EXISTS "reason" TEXT;
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_actorUserId_idx" ON "AuditPermissionLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_targetUserId_idx" ON "AuditPermissionLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_permissionId_idx" ON "AuditPermissionLog"("permissionId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_createdAt_idx" ON "AuditPermissionLog"("createdAt");
