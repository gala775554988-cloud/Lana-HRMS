-- Aggregate per-employee leave balance (one row per employee, matching how
-- the portal dashboard and CSV import already treat leave balance as a
-- single number rather than per-LeaveType). accrued is admin-editable;
-- used is system-maintained by the workflow-approval hook.
CREATE TABLE IF NOT EXISTS "EmployeeLeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accrued" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLeaveBalance_employeeId_key" ON "EmployeeLeaveBalance"("employeeId");

ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
