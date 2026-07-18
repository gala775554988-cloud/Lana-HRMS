-- Speeds up the pending-approvals-count query (polled from the sidebar
-- badge) which filters WorkflowStep by approverUserId + status together.
CREATE INDEX IF NOT EXISTS "WorkflowStep_approverUserId_status_idx" ON "WorkflowStep"("approverUserId", "status");
