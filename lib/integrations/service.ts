'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { decryptSecret, encryptSecret, createApiKey, hashApiKey, createOAuthClientSecret, verifyWebhookSignature } from "@/lib/integrations/security";
import { OdooJsonRpcClient } from "@/lib/integrations/odoo";
import { odooModuleMappings } from "@/lib/integrations/catalog";
import { isOdooIntegrationEnabled } from "@/lib/settings";

type Delegate = {
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(args?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  upsert?(args: Record<string, unknown>): Promise<Record<string, unknown>>;
};

function delegate(model: string) {
  return (prisma as unknown as Record<string, Delegate>)[model];
}

export async function requireIntegrationAccess(action: "read" | "manage" = "read") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  const permissions = session.user.permissions as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(permissions, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

export async function seedOdooProvider() {
  await requireIntegrationAccess("manage");
  const provider = await prisma.integrationProvider.upsert({
    where: { code: "odoo" },
    update: { type: "ODOO", authType: "ODOO_JSON_RPC", isActive: true },
    create: { name: "Odoo", code: "odoo", type: "ODOO", baseUrl: process.env.ODOO_URL || "https://odoo.example.com", authType: "ODOO_JSON_RPC", isActive: true }
  });
  for (const item of odooModuleMappings) {
    await prisma.integrationMapping.upsert({
      where: { id: `${provider.id}-${item.hrmsModule}` },
      update: { providerId: provider.id, ...item, direction: "BIDIRECTIONAL", isActive: true },
      create: { id: `${provider.id}-${item.hrmsModule}`, providerId: provider.id, name: `Odoo ${item.hrmsModule}`, ...item, direction: "BIDIRECTIONAL", isActive: true }
    });
  }
  revalidatePath("/integrations");
  return provider;
}

export async function createOdooConnection(input: { providerId?: string; name: string; baseUrl: string; database: string; username: string; password: string }) {
  await requireIntegrationAccess("manage");
  const provider = input.providerId ? await prisma.integrationProvider.findUnique({ where: { id: input.providerId } }) : await seedOdooProvider();
  if (!provider) throw new Error("Provider not found");
  const connection = await prisma.integrationConnection.create({
    data: {
      providerId: provider.id,
      name: input.name,
      baseUrl: input.baseUrl,
      database: input.database,
      username: input.username,
      secretCipher: encryptSecret(input.password),
      status: "DISCONNECTED"
    }
  });
  revalidatePath("/integrations/connections");
  return connection;
}

export async function getOdooClient(connectionId: string) {
  const connection = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error("Connection not found");
  return {
    connection,
    client: new OdooJsonRpcClient({
      baseUrl: connection.baseUrl,
      database: connection.database,
      username: connection.username,
      password: decryptSecret(connection.secretCipher),
      uid: connection.uid,
      sessionId: connection.sessionId
    })
  };
}

export async function testOdooConnection(connectionId: string) {
  await requireIntegrationAccess("manage");
  const { connection, client } = await getOdooClient(connectionId);
  try {
    const uid = await client.authenticate(connection.database || "", connection.username || "", decryptSecret(connection.secretCipher));
    const version = await client.version().catch(() => null);
    const session = client.getSession();
    const updated = await prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { uid, sessionId: session.sessionId, version: (version || undefined) as any, status: "CONNECTED", lastTestAt: new Date(), lastError: null }
    });
    await logIntegration({ connectionId, providerId: connection.providerId, action: "ODOO_TEST", message: "Odoo connection authenticated", response: { uid, version } });
    return { success: true, connection: updated, uid, version };
  } catch (error) {
    await prisma.integrationConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastTestAt: new Date(), lastError: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

function mapToExternal(record: Record<string, unknown>, fieldMap: Record<string, string>) {
  return Object.fromEntries(Object.entries(fieldMap).map(([local, external]) => [external, record[local]]).filter(([, value]) => value !== undefined && value !== null));
}

function mapToLocal(record: Record<string, unknown>, fieldMap: Record<string, string>) {
  return Object.fromEntries(Object.entries(fieldMap).map(([local, external]) => [local, record[external]]).filter(([, value]) => value !== undefined && value !== null));
}

async function assertOdooProviderEnabled(providerId: string) {
  const provider = await prisma.integrationProvider.findUnique({ where: { id: providerId } });
  if (provider?.code === "odoo" && !(await isOdooIntegrationEnabled())) {
    throw new Error("Odoo integration is disabled");
  }
}

export async function enqueueSync(input: { connectionId: string; mappingId?: string; direction: "HRMS_TO_ODOO" | "ODOO_TO_HRMS" | "BIDIRECTIONAL"; operation?: string; entity?: string; payload?: Record<string, unknown> }) {
  await requireIntegrationAccess("manage");
  const connection = await prisma.integrationConnection.findUnique({ where: { id: input.connectionId } });
  if (!connection) throw new Error("Connection not found");
  await assertOdooProviderEnabled(connection.providerId);
  const mapping = input.mappingId ? await prisma.integrationMapping.findUnique({ where: { id: input.mappingId } }) : null;
  return prisma.integrationQueue.create({
    data: {
      providerId: connection.providerId,
      connectionId: connection.id,
      mappingId: mapping?.id,
      direction: input.direction,
      operation: input.operation || "SYNC",
      entity: input.entity || mapping?.hrmsModule || "all",
      payload: (input.payload || {}) as any
    }
  });
}

export async function syncMapping(connectionId: string, mappingId: string, direction: "HRMS_TO_ODOO" | "ODOO_TO_HRMS" | "BIDIRECTIONAL") {
  await requireIntegrationAccess("manage");
  const { connection, client } = await getOdooClient(connectionId);
  await assertOdooProviderEnabled(connection.providerId);
  if (!connection.uid) await testOdooConnection(connectionId);
  const mapping = await prisma.integrationMapping.findUnique({ where: { id: mappingId } });
  if (!mapping) throw new Error("Mapping not found");
  const history = await prisma.syncHistory.create({ data: { connectionId, mappingId, direction, entity: mapping.hrmsModule, status: "RUNNING" } });
  const fieldMap = mapping.fieldMap as Record<string, string>;
  let pushed = 0, pulled = 0, createdCount = 0, updatedCount = 0;
  try {
    const localDelegate = delegate(mapping.hrmsModel);
    if (!localDelegate) throw new Error(`Missing Prisma delegate ${mapping.hrmsModel}`);
    if (direction === "HRMS_TO_ODOO" || direction === "BIDIRECTIONAL") {
      const records = await localDelegate.findMany({ take: 50, orderBy: { updatedAt: "desc" } }).catch(() => localDelegate.findMany({ take: 50 }));
      for (const record of records) {
        const values = mapToExternal(record, fieldMap);
        if (Object.keys(values).length === 0) continue;
        await client.create(mapping.externalModel, values);
        pushed += 1;
        createdCount += 1;
      }
    }
    if (direction === "ODOO_TO_HRMS" || direction === "BIDIRECTIONAL") {
      const externalFields = Array.from(new Set(["id", ...Object.values(fieldMap)]));
      const rows = await client.searchRead<Record<string, unknown>>(mapping.externalModel, [], externalFields, { limit: 50 });
      for (const row of rows) {
        const localValues = mapToLocal(row, fieldMap);
        if (Object.keys(localValues).length === 0) continue;
        await localDelegate.create({ data: localValues }).catch(async () => {
          await prisma.conflictLog.create({ data: { connectionId, mappingId, entity: mapping.hrmsModule, externalId: String(row.id ?? ""), externalValue: row as any, localValue: localValues as any, resolution: "PENDING" } });
        });
        pulled += 1;
        createdCount += 1;
      }
    }
    const result = await prisma.syncHistory.update({ where: { id: history.id }, data: { status: "COMPLETED", finishedAt: new Date(), pushed, pulled, createdCount, updatedCount } });
    await logIntegration({ providerId: connection.providerId, connectionId, action: "SYNC", message: `Sync completed for ${mapping.hrmsModule}`, response: result });
    return result;
  } catch (error) {
    await prisma.syncHistory.update({ where: { id: history.id }, data: { status: "FAILED", finishedAt: new Date(), error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

export async function processIntegrationQueue(limit = 10) {
  await requireIntegrationAccess("manage");
  const rows = await prisma.integrationQueue.findMany({ where: { status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: new Date() } }, take: limit, orderBy: { createdAt: "asc" } });
  const results = [];
  for (const row of rows) {
    await prisma.integrationQueue.update({ where: { id: row.id }, data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } } });
    try {
      let result: unknown = { skipped: true };
      if (row.mappingId && row.connectionId) result = await syncMapping(row.connectionId, row.mappingId, row.direction as "HRMS_TO_ODOO" | "ODOO_TO_HRMS" | "BIDIRECTIONAL");
      const updated = await prisma.integrationQueue.update({ where: { id: row.id }, data: { status: "DONE", result: result as object, processedAt: new Date(), lastError: null } });
      results.push(updated);
    } catch (error) {
      const attempts = row.attempts + 1;
      const dead = attempts >= row.maxAttempts;
      const updated = await prisma.integrationQueue.update({ where: { id: row.id }, data: { status: dead ? "DEAD" : "RETRY", deadLetterAt: dead ? new Date() : null, availableAt: new Date(Date.now() + Math.min(60_000 * attempts, 300_000)), lastError: error instanceof Error ? error.message : String(error) } });
      results.push(updated);
    }
  }
  return results;
}

export async function retryDeadLetter(id: string) {
  await requireIntegrationAccess("manage");
  return prisma.integrationQueue.update({ where: { id }, data: { status: "RETRY", deadLetterAt: null, availableAt: new Date(), lastError: null } });
}

export async function resolveConflict(id: string, resolution: "USE_LOCAL" | "USE_EXTERNAL" | "MERGED", resolvedValue?: unknown) {
  const session = await requireIntegrationAccess("manage");
  return prisma.conflictLog.update({ where: { id }, data: { resolution, resolvedValue: resolvedValue as object, resolvedById: session.user.id, resolvedAt: new Date() } });
}

export async function createIntegrationApiKey(providerId: string | null, name: string, scopes: string[]) {
  await requireIntegrationAccess("manage");
  const raw = createApiKey("lana_int");
  const record = await prisma.integrationApiKey.create({ data: { providerId, name, keyHash: hashApiKey(raw), secretCipher: encryptSecret(raw), scopes } });
  return { record, key: raw };
}

export async function createOAuthClient(providerId: string | null, name: string, redirectUris: string[], scopes: string[], grants = ["client_credentials"]) {
  await requireIntegrationAccess("manage");
  const clientId = `lana_${cryptoRandom()}`;
  const secret = createOAuthClientSecret();
  const record = await prisma.integrationOAuthClient.create({ data: { providerId, name, clientId, clientSecretCipher: encryptSecret(secret), redirectUris, scopes, grants } });
  return { record, clientSecret: secret };
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function verifyIncomingWebhook(providerId: string, payload: string, signature: string | null) {
  const webhook = await prisma.integrationWebhook.findFirst({ where: { providerId, isActive: true } });
  if (!webhook) return false;
  return verifyWebhookSignature(payload, signature, decryptSecret(webhook.secretCipher));
}

export async function logIntegration(input: { providerId?: string | null; connectionId?: string | null; jobId?: string | null; queueId?: string | null; level?: string; action: string; message: string; request?: unknown; response?: unknown; metadata?: unknown }) {
  return prisma.integrationLog.create({ data: { ...input, level: input.level || "INFO", request: input.request as object, response: input.response as object, metadata: input.metadata as object } });
}
