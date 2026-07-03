ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "profilePhotoUrl" TEXT;
UPDATE "Employee" SET "nationalId" = "employeeNumber" WHERE "nationalId" IS NULL;
ALTER TABLE "Employee" ALTER COLUMN "nationalId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_nationalId_key" ON "Employee"("nationalId");
CREATE INDEX IF NOT EXISTS "Employee_nationalId_idx" ON "Employee"("nationalId");