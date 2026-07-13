-- Round 2: drop the dead "enterprise/AI/platform" layer.
-- Every table below is confirmed to have zero rows in production (verified
-- immediately before this migration) and zero remaining application code
-- references (the pages/routes/lib modules that used them were removed in
-- the same change). CASCADE is safe here: every FK among these tables is
-- owned by a table also being dropped in this same statement set -- none
-- of them are referenced FROM a table we are keeping.

DROP TABLE IF EXISTS "AILog" CASCADE;
DROP TABLE IF EXISTS "AIPromptLibraryItem" CASCADE;
DROP TABLE IF EXISTS "AuditIntelligenceRecord" CASCADE;
DROP TABLE IF EXISTS "AuditPermissionLog" CASCADE;
DROP TABLE IF EXISTS "AutomationRecord" CASCADE;
DROP TABLE IF EXISTS "DataFabricAsset" CASCADE;
DROP TABLE IF EXISTS "DecisionExecution" CASCADE;
DROP TABLE IF EXISTS "DecisionPolicy" CASCADE;
DROP TABLE IF EXISTS "DecisionRule" CASCADE;
DROP TABLE IF EXISTS "DeploymentCenterRecord" CASCADE;
DROP TABLE IF EXISTS "DigitalTwinCompany" CASCADE;
DROP TABLE IF EXISTS "DigitalTwinEmployee" CASCADE;
DROP TABLE IF EXISTS "DigitalTwinOrganization" CASCADE;
DROP TABLE IF EXISTS "DigitalTwinScenario" CASCADE;
DROP TABLE IF EXISTS "DocumentAIRecord" CASCADE;
DROP TABLE IF EXISTS "EdgeSyncRecord" CASCADE;
DROP TABLE IF EXISTS "EnterpriseAdminRecord" CASCADE;
DROP TABLE IF EXISTS "EnterprisePlatformRecord" CASCADE;
DROP TABLE IF EXISTS "EnterpriseRecord" CASCADE;
DROP TABLE IF EXISTS "EnterpriseSearchIndex" CASCADE;
DROP TABLE IF EXISTS "EnterpriseWorkflowTemplate" CASCADE;
DROP TABLE IF EXISTS "EventStoreRecord" CASCADE;
DROP TABLE IF EXISTS "GenerativeReport" CASCADE;
DROP TABLE IF EXISTS "KnowledgeCategory" CASCADE;
DROP TABLE IF EXISTS "KnowledgeNode" CASCADE;
DROP TABLE IF EXISTS "KnowledgeRelation" CASCADE;
DROP TABLE IF EXISTS "LoginHistory" CASCADE;
DROP TABLE IF EXISTS "LowCodeArtifact" CASCADE;
DROP TABLE IF EXISTS "MessageQueueRecord" CASCADE;
DROP TABLE IF EXISTS "MonitoringEnterpriseRecord" CASCADE;
DROP TABLE IF EXISTS "MonitoringMetric" CASCADE;
DROP TABLE IF EXISTS "MultiRegionConfig" CASCADE;
DROP TABLE IF EXISTS "NotificationQueue" CASCADE;
DROP TABLE IF EXISTS "ObservabilityRecord" CASCADE;
DROP TABLE IF EXISTS "ObservabilitySpan" CASCADE;
DROP TABLE IF EXISTS "PlatformBackgroundJob" CASCADE;
DROP TABLE IF EXISTS "PredictiveModel" CASCADE;
DROP TABLE IF EXISTS "PredictiveRun" CASCADE;
DROP TABLE IF EXISTS "ProcessMiningEvent" CASCADE;
DROP TABLE IF EXISTS "ProcessMiningInsight" CASCADE;
DROP TABLE IF EXISTS "ProductionAreaRecord" CASCADE;
DROP TABLE IF EXISTS "SaasCoupon" CASCADE;
DROP TABLE IF EXISTS "SaasInvoice" CASCADE;
DROP TABLE IF EXISTS "SaasLicense" CASCADE;
DROP TABLE IF EXISTS "SaasPayment" CASCADE;
DROP TABLE IF EXISTS "SaasPlan" CASCADE;
DROP TABLE IF EXISTS "SaasPlatformRecord" CASCADE;
DROP TABLE IF EXISTS "SaasSubscription" CASCADE;
DROP TABLE IF EXISTS "SaasUsageRecord" CASCADE;
DROP TABLE IF EXISTS "ScheduledReport" CASCADE;
DROP TABLE IF EXISTS "SchedulerRecord" CASCADE;
DROP TABLE IF EXISTS "SecurityEnterpriseRecord" CASCADE;
DROP TABLE IF EXISTS "SecurityPolicy" CASCADE;
DROP TABLE IF EXISTS "Tenant" CASCADE;
DROP TABLE IF EXISTS "UserDevice" CASCADE;
DROP TABLE IF EXISTS "ZeroTrustPolicy" CASCADE;
