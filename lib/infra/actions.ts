'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getInfraArea } from "@/lib/infra/catalog";

type Json = Record<string, unknown>;

async function requireInfra(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

function parseJson(raw: FormDataEntryValue | null, fallback: Json = {}) {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  try { return JSON.parse(value) as Json; } catch { return { text: value }; }
}

function baseWhere(feature: string, search: string) {
  const needle = search ? { contains: search, mode: "insensitive" as const } : undefined;
  return search ? { OR: [{ name: needle }, { status: needle }, { type: needle }, { code: needle }, { provider: needle }, { stream: needle }, { queueName: needle }, { eventType: needle }] } : {};
}

export async function listInfraRecords(area: string, feature: string, search = "") {
  await requireInfra("read");
  const meta = getInfraArea(area);
  if (!meta || !meta.features.includes(feature as never)) throw new Error("Unknown infrastructure feature");
  switch (area) {
    case "event-bus": return prisma.eventStoreRecord.findMany({ where: { eventType: feature, ...baseWhere(feature, search) as any }, orderBy: { createdAt: "desc" }, take: 100 });
    case "message-queue": return prisma.messageQueueRecord.findMany({ where: { jobType: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "scheduler": return prisma.schedulerRecord.findMany({ where: { jobType: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "notification-pipeline": return prisma.notificationPipelineRecord.findMany({ where: { queueName: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "audit-intelligence": return prisma.auditIntelligenceRecord.findMany({ where: { action: feature, ...baseWhere(feature, search) as any }, orderBy: { createdAt: "desc" }, take: 100 });
    case "integration-hub": return prisma.infrastructureConnector.findMany({ where: { provider: feature.toUpperCase(), ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "ai-copilot": return prisma.aICopilotRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "document-ai": return prisma.documentAIRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "bi-engine": return prisma.bIEngineRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "security-enterprise": return prisma.securityEnterpriseRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "devops-center": return prisma.devOpsCenterRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "monitoring-enterprise": return prisma.monitoringEnterpriseRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { capturedAt: "desc" }, take: 100 });
    case "database-studio": return prisma.databaseStudioRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "enterprise-admin-center": return prisma.enterpriseAdminRecord.findMany({ where: { type: feature, ...baseWhere(feature, search) as any }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "white-label-platform": return prisma.whiteLabelRecord.findMany({ where: baseWhere(feature, search) as any, orderBy: { updatedAt: "desc" }, take: 100 });
    case "marketplace": return prisma.marketplacePlugin.findMany({ where: baseWhere(feature, search) as any, orderBy: { updatedAt: "desc" }, take: 100 });
    default: return [];
  }
}

export async function saveInfraRecord(formData: FormData) {
  const session = await requireInfra("manage");
  const area = String(formData.get("area") || "");
  const feature = String(formData.get("feature") || "");
  const meta = getInfraArea(area);
  if (!meta || !meta.features.includes(feature as never)) throw new Error("Unknown infrastructure feature");
  const code = String(formData.get("code") || Date.now()).trim();
  const name = String(formData.get("name") || code).trim();
  const payload = parseJson(formData.get("payload"), { enabled: true });
  const commonAudit = { actorUserId: session.user.id, action: "infra:save", entity: `${area}/${feature}`, entityId: code, metadata: payload as any };
  switch (area) {
    case "event-bus": await prisma.eventStoreRecord.create({ data: { stream: name, eventType: feature, aggregateType: area, aggregateId: code, payload: payload as any, metadata: { publisher: session.user.id } as any } }); break;
    case "message-queue": await prisma.messageQueueRecord.create({ data: { provider: feature.includes("rabbit") ? "RABBITMQ" : "REDIS", queueName: feature, jobType: feature, payload: payload as any, delayedUntil: new Date(Date.now() + 60000) } }); break;
    case "scheduler": await prisma.schedulerRecord.upsert({ where: { code }, update: { name, jobType: feature, payload: payload as any }, create: { code, name, cron: String((payload as any).cron || "*/5 * * * *"), jobType: feature, payload: payload as any } }); break;
    case "notification-pipeline": await prisma.notificationPipelineRecord.create({ data: { channel: feature.split("-")[0].toUpperCase(), queueName: feature, recipient: String((payload as any).recipient || "system"), payload: payload as any } }); break;
    case "audit-intelligence": await prisma.auditIntelligenceRecord.create({ data: { actorUserId: session.user.id, objectType: area, objectId: code, action: feature, before: {} as any, after: payload as any, fieldDiff: payload as any, ipAddress: String((payload as any).ip || ""), deviceHash: String((payload as any).device || "") } }); break;
    case "integration-hub": await prisma.infrastructureConnector.upsert({ where: { tenantId_provider_name: { tenantId: "", provider: feature.toUpperCase(), name } }, update: { config: payload as any }, create: { tenantId: "", provider: feature.toUpperCase(), name, authType: String((payload as any).authType || "API_KEY"), config: payload as any, baseUrl: String((payload as any).baseUrl || "") || null } }); break;
    case "ai-copilot": await prisma.aICopilotRecord.create({ data: { type: feature, prompt: name, context: payload as any, output: { status: "READY" }, model: process.env.OPENAI_MODEL || null, createdById: session.user.id } }); break;
    case "document-ai": await prisma.documentAIRecord.create({ data: { type: feature, fileUrl: String((payload as any).fileUrl || "/api/uploads"), language: String((payload as any).language || "auto"), entities: payload as any } }); break;
    case "bi-engine": await prisma.bIEngineRecord.upsert({ where: { tenantId_type_code: { tenantId: "", type: feature, code } }, update: { name, definition: payload as any }, create: { tenantId: "", type: feature, code, name, definition: payload as any, result: { generatedAt: new Date().toISOString() } } }); break;
    case "security-enterprise": await prisma.securityEnterpriseRecord.create({ data: { type: feature, provider: String((payload as any).provider || feature), name, config: payload as any, riskScore: Number((payload as any).riskScore || 0) } }); break;
    case "devops-center": await prisma.devOpsCenterRecord.create({ data: { type: feature, name, environment: String((payload as any).environment || "production"), config: payload as any } }); break;
    case "monitoring-enterprise": await prisma.monitoringEnterpriseRecord.create({ data: { type: feature, source: name, metric: code, value: Number((payload as any).value || 1), unit: String((payload as any).unit || "count"), metadata: payload as any } }); break;
    case "database-studio": await prisma.databaseStudioRecord.create({ data: { type: feature, name, schemaName: String((payload as any).schema || "public"), artifact: payload as any } }); break;
    case "enterprise-admin-center": await prisma.enterpriseAdminRecord.create({ data: { type: feature, name, plan: String((payload as any).plan || "enterprise"), usage: payload as any, billing: payload as any, config: payload as any } }); break;
    case "white-label-platform": await prisma.whiteLabelRecord.create({ data: { domain: String((payload as any).domain || "") || null, logoUrl: String((payload as any).logoUrl || "") || null, theme: payload as any, fonts: payload as any, colors: payload as any, emailBranding: payload as any, loginBranding: payload as any } }); break;
    case "marketplace": await prisma.marketplacePlugin.upsert({ where: { code }, update: { name, manifest: payload as any }, create: { code, name, version: String((payload as any).version || "1.0.0"), manifest: payload as any, dependencies: [] } }); break;
  }
  await prisma.auditLog.create({ data: commonAudit }).catch(() => null);
  revalidatePath(`/infra/${area}/${feature}`);
}

export async function deleteInfraRecord(formData: FormData) {
  await requireInfra("manage");
  const area = String(formData.get("area"));
  const id = String(formData.get("id"));
  const meta = getInfraArea(area);
  if (!meta) throw new Error("Unknown infrastructure area");
  await (prisma as any)[meta.model].delete({ where: { id } });
  revalidatePath(`/infra/${area}/${String(formData.get("feature"))}`);
}

export async function infraMetrics() {
  await requireInfra("read");
  const counts = await Promise.all([
    prisma.eventStoreRecord.count().catch(() => 0), prisma.messageQueueRecord.count().catch(() => 0), prisma.schedulerRecord.count().catch(() => 0), prisma.notificationPipelineRecord.count().catch(() => 0), prisma.auditIntelligenceRecord.count().catch(() => 0), prisma.infrastructureConnector.count().catch(() => 0), prisma.aICopilotRecord.count().catch(() => 0), prisma.documentAIRecord.count().catch(() => 0), prisma.bIEngineRecord.count().catch(() => 0), prisma.securityEnterpriseRecord.count().catch(() => 0), prisma.devOpsCenterRecord.count().catch(() => 0), prisma.monitoringEnterpriseRecord.count().catch(() => 0), prisma.databaseStudioRecord.count().catch(() => 0), prisma.enterpriseAdminRecord.count().catch(() => 0), prisma.whiteLabelRecord.count().catch(() => 0), prisma.marketplacePlugin.count().catch(() => 0)
  ]);
  return counts.reduce((sum, value) => sum + value, 0);
}
