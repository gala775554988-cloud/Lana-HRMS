-- Enterprise ERP / Odoo integration tables
CREATE TABLE IF NOT EXISTS "IntegrationProvider" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "type" TEXT NOT NULL DEFAULT 'ODOO',
  "baseUrl" TEXT NOT NULL,
  "authType" TEXT NOT NULL DEFAULT 'ODOO_JSON_RPC',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "database" TEXT,
  "username" TEXT,
  "uid" INTEGER,
  "sessionId" TEXT,
  "secretCipher" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "lastTestAt" TIMESTAMP(3),
  "lastError" TEXT,
  "version" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "connectionId" TEXT REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "hrmsModule" TEXT NOT NULL,
  "hrmsModel" TEXT NOT NULL,
  "externalModel" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
  "keyField" TEXT NOT NULL DEFAULT 'id',
  "externalKeyField" TEXT NOT NULL DEFAULT 'id',
  "fieldMap" JSONB NOT NULL,
  "transformMap" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "connectionId" TEXT REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "mappingId" TEXT REFERENCES "IntegrationMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "direction" TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
  "schedule" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationQueue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "connectionId" TEXT REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "mappingId" TEXT REFERENCES "IntegrationMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "jobId" TEXT REFERENCES "IntegrationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "queueName" TEXT NOT NULL DEFAULT 'default',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "direction" TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
  "operation" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "externalId" TEXT,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "deadLetterAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationWebhook" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secretCipher" TEXT,
  "events" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastDeliveryAt" TIMESTAMP(3),
  "lastStatus" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "connectionId" TEXT REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "jobId" TEXT REFERENCES "IntegrationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "queueId" TEXT REFERENCES "IntegrationQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "level" TEXT NOT NULL DEFAULT 'INFO',
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "request" JSONB,
  "response" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationApiKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL UNIQUE,
  "secretCipher" TEXT,
  "scopes" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationOAuthClient" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "clientId" TEXT NOT NULL UNIQUE,
  "clientSecretCipher" TEXT NOT NULL,
  "redirectUris" JSONB NOT NULL,
  "scopes" JSONB NOT NULL,
  "grants" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntegrationSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("providerId", "key")
);
CREATE TABLE IF NOT EXISTS "SyncHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "connectionId" TEXT NOT NULL REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "mappingId" TEXT REFERENCES "IntegrationMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "direction" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "pulled" INTEGER NOT NULL DEFAULT 0,
  "pushed" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "deletedCount" INTEGER NOT NULL DEFAULT 0,
  "conflictCount" INTEGER NOT NULL DEFAULT 0,
  "cursor" TEXT,
  "error" TEXT,
  "metadata" JSONB
);
CREATE TABLE IF NOT EXISTS "ConflictLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "connectionId" TEXT NOT NULL REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "mappingId" TEXT REFERENCES "IntegrationMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "entity" TEXT NOT NULL,
  "localId" TEXT,
  "externalId" TEXT,
  "field" TEXT,
  "localValue" JSONB,
  "externalValue" JSONB,
  "resolution" TEXT NOT NULL DEFAULT 'PENDING',
  "resolvedValue" JSONB,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "IntegrationProvider_type_idx" ON "IntegrationProvider"("type");
CREATE INDEX IF NOT EXISTS "IntegrationProvider_isActive_idx" ON "IntegrationProvider"("isActive");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_providerId_idx" ON "IntegrationConnection"("providerId");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_status_idx" ON "IntegrationConnection"("status");
CREATE INDEX IF NOT EXISTS "IntegrationMapping_providerId_idx" ON "IntegrationMapping"("providerId");
CREATE INDEX IF NOT EXISTS "IntegrationMapping_connectionId_idx" ON "IntegrationMapping"("connectionId");
CREATE INDEX IF NOT EXISTS "IntegrationMapping_hrmsModule_idx" ON "IntegrationMapping"("hrmsModule");
CREATE INDEX IF NOT EXISTS "IntegrationMapping_externalModel_idx" ON "IntegrationMapping"("externalModel");
CREATE INDEX IF NOT EXISTS "IntegrationMapping_isActive_idx" ON "IntegrationMapping"("isActive");
CREATE INDEX IF NOT EXISTS "IntegrationJob_status_idx" ON "IntegrationJob"("status");
CREATE INDEX IF NOT EXISTS "IntegrationJob_type_idx" ON "IntegrationJob"("type");
CREATE INDEX IF NOT EXISTS "IntegrationJob_runAt_idx" ON "IntegrationJob"("runAt");
CREATE INDEX IF NOT EXISTS "IntegrationJob_connectionId_idx" ON "IntegrationJob"("connectionId");
CREATE INDEX IF NOT EXISTS "IntegrationQueue_status_idx" ON "IntegrationQueue"("status");
CREATE INDEX IF NOT EXISTS "IntegrationQueue_queueName_idx" ON "IntegrationQueue"("queueName");
CREATE INDEX IF NOT EXISTS "IntegrationQueue_availableAt_idx" ON "IntegrationQueue"("availableAt");
CREATE INDEX IF NOT EXISTS "IntegrationQueue_connectionId_idx" ON "IntegrationQueue"("connectionId");
CREATE INDEX IF NOT EXISTS "IntegrationQueue_entity_entityId_idx" ON "IntegrationQueue"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "IntegrationWebhook_providerId_idx" ON "IntegrationWebhook"("providerId");
CREATE INDEX IF NOT EXISTS "IntegrationWebhook_isActive_idx" ON "IntegrationWebhook"("isActive");
CREATE INDEX IF NOT EXISTS "IntegrationLog_level_idx" ON "IntegrationLog"("level");
CREATE INDEX IF NOT EXISTS "IntegrationLog_action_idx" ON "IntegrationLog"("action");
CREATE INDEX IF NOT EXISTS "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");
CREATE INDEX IF NOT EXISTS "IntegrationLog_connectionId_idx" ON "IntegrationLog"("connectionId");
CREATE INDEX IF NOT EXISTS "IntegrationApiKey_providerId_idx" ON "IntegrationApiKey"("providerId");
CREATE INDEX IF NOT EXISTS "IntegrationApiKey_isActive_idx" ON "IntegrationApiKey"("isActive");
CREATE INDEX IF NOT EXISTS "IntegrationOAuthClient_providerId_idx" ON "IntegrationOAuthClient"("providerId");
CREATE INDEX IF NOT EXISTS "IntegrationOAuthClient_isActive_idx" ON "IntegrationOAuthClient"("isActive");
CREATE INDEX IF NOT EXISTS "IntegrationSetting_key_idx" ON "IntegrationSetting"("key");
CREATE INDEX IF NOT EXISTS "SyncHistory_connectionId_idx" ON "SyncHistory"("connectionId");
CREATE INDEX IF NOT EXISTS "SyncHistory_mappingId_idx" ON "SyncHistory"("mappingId");
CREATE INDEX IF NOT EXISTS "SyncHistory_status_idx" ON "SyncHistory"("status");
CREATE INDEX IF NOT EXISTS "SyncHistory_startedAt_idx" ON "SyncHistory"("startedAt");
CREATE INDEX IF NOT EXISTS "ConflictLog_connectionId_idx" ON "ConflictLog"("connectionId");
CREATE INDEX IF NOT EXISTS "ConflictLog_mappingId_idx" ON "ConflictLog"("mappingId");
CREATE INDEX IF NOT EXISTS "ConflictLog_resolution_idx" ON "ConflictLog"("resolution");
CREATE INDEX IF NOT EXISTS "ConflictLog_entity_idx" ON "ConflictLog"("entity");
