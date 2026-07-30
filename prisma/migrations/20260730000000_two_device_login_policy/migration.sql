-- Global two-device login policy: preserve existing bindings while allowing
-- each employee to bind a second distinct device. No employee/account rows
-- are deleted by this migration.
DROP INDEX IF EXISTS "EmployeeMobileDevice_employeeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_deviceId_key" ON "EmployeeMobileDevice"("employeeId", "deviceId");
CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_idx" ON "EmployeeMobileDevice"("employeeId");
ALTER TABLE "User" ALTER COLUMN "canUseMultipleDevices" SET DEFAULT true;
UPDATE "User" SET "canUseMultipleDevices" = true WHERE "canUseMultipleDevices" = false;
