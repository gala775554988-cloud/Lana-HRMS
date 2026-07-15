-- PermissionGroup.isSystem/key/nameAr/parentId exist in schema.prisma but
-- were never captured in a migration (found via `prisma migrate diff`
-- against a fully-migrated fresh database) -- a fresh deploy or
-- disaster-recovery restore would be missing them entirely, same class of
-- bug as the earlier missing Employee.sponsor migration.
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
ALTER TABLE "PermissionGroup" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PermissionGroup_key_key" ON "PermissionGroup"("key");
CREATE INDEX IF NOT EXISTS "PermissionGroup_key_idx" ON "PermissionGroup"("key");
