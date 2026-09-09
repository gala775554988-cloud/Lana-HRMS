-- Ensure the mobile-device binding table exists before the two-device policy
-- migration adjusts its indexes. The migration is idempotent for databases
-- where the table was provisioned previously through schema synchronization.
CREATE TABLE IF NOT EXISTS "EmployeeMobileDevice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'mobile',
  "fcmToken" TEXT,
  "pushSubscription" JSONB,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeMobileDevice_deviceId_key"
  ON "EmployeeMobileDevice"("deviceId");
CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_employeeId_idx"
  ON "EmployeeMobileDevice"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeMobileDevice_deviceId_idx"
  ON "EmployeeMobileDevice"("deviceId");

DO $$
BEGIN
  ALTER TABLE "EmployeeMobileDevice"
    ADD CONSTRAINT "EmployeeMobileDevice_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
