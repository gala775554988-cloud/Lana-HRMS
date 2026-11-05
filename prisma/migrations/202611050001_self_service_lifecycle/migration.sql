CREATE INDEX "WorkflowInstance_employeeId_status_createdAt_idx" ON "WorkflowInstance"("employeeId", "status", "createdAt");
CREATE INDEX "WorkflowInstance_type_entityId_idx" ON "WorkflowInstance"("type", "entityId");
-- A rejected/returned revocation does not prevent a new review. Concurrent pending duplicates do.
CREATE UNIQUE INDEX "WorkflowInstance_pending_revocation_key" ON "WorkflowInstance"("entityId") WHERE "type" = 'REVOKE' AND "status" = 'PENDING';
