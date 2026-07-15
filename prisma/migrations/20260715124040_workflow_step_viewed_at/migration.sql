-- Tracks when the assigned approver actually opened a pending approval step,
-- so employees can see read/seen status for their own requests.
ALTER TABLE "WorkflowStep" ADD COLUMN "viewedAt" TIMESTAMP(3);
