-- Per-user override so SUPER_ADMIN/MANAGER (or any user explicitly flagged
-- by an admin) can bypass the single-device login lock in
-- lib/cache/device-cache.ts without disabling it system-wide.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canUseMultipleDevices" BOOLEAN NOT NULL DEFAULT false;
