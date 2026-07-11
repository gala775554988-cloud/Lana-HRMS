-- Add password change tracking fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChanged" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPasswordResetBy" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPasswordResetAt" TIMESTAMP(3);

-- For existing users, set passwordChanged=true and mustChangePassword=false (they already have passwords)
-- For new Odoo accounts, these will be set to mustChangePassword=true, passwordChanged=false

-- Add index for performance
CREATE INDEX IF NOT EXISTS "User_mustChangePassword_idx" ON "User"("mustChangePassword");
CREATE INDEX IF NOT EXISTS "User_passwordChanged_idx" ON "User"("passwordChanged");
