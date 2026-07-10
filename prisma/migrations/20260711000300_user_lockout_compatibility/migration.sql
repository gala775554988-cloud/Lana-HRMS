-- Compatibility columns for deployed auth clients that used the previous account-lockout naming.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
UPDATE "User" SET "lockedReason" = COALESCE("lockedReason", "lockReason");
