-- Enterprise RBAC + Custom Permissions
CREATE TABLE IF NOT EXISTS "PermissionGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserPermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "isGranted" BOOLEAN NOT NULL DEFAULT true,
  "grantedById" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "reason" TEXT,
  CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");
CREATE INDEX IF NOT EXISTS "UserPermission_userId_idx" ON "UserPermission"("userId");
CREATE INDEX IF NOT EXISTS "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");
CREATE INDEX IF NOT EXISTS "UserPermission_isGranted_idx" ON "UserPermission"("isGranted");

CREATE TABLE IF NOT EXISTS "AuditPermissionLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "action" TEXT NOT NULL,
  "permissionId" TEXT,
  "roleId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "device" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditPermissionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditPermissionLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditPermissionLog_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditPermissionLog_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditPermissionLog_actorUserId_idx" ON "AuditPermissionLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_targetUserId_idx" ON "AuditPermissionLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AuditPermissionLog_createdAt_idx" ON "AuditPermissionLog"("createdAt");

-- Add columns to Permission for grouping
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "groupCode" TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Add columns to User for account management
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;

-- Add isPendingActivation for employees pending activation (new employees disappear every 30 days)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isPendingActivation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "pendingActivationUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Employee_isPendingActivation_idx" ON "Employee"("isPendingActivation");
CREATE INDEX IF NOT EXISTS "Employee_pendingActivationUntil_idx" ON "Employee"("pendingActivationUntil");
