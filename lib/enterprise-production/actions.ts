'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getProductionArea } from "@/lib/enterprise-production/catalog";

type AnyRecord = Record<string, any>;

async function requireAccess(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

function parseJson(value: FormDataEntryValue | null, fallback: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return { text: raw }; }
}

export async function listProductionRecords(areaKey: string, search = "") {
  await requireAccess("read");
  const area = getProductionArea(areaKey);
  if (!area) throw new Error("Unknown production area");
  const whereText = search ? { contains: search, mode: "insensitive" as const } : undefined;
  switch (areaKey) {
    case "dashboard-engine": return prisma.dashboardDefinition.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { audience: whereText }] } : {}, include: { widgets: true }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "workflow-engine": return prisma.workflowDefinition.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { entity: whereText }] } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
    case "report-designer": return prisma.reportDesign.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { module: whereText }] } : {}, include: { schedules: true }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "notification-center": return prisma.notificationTemplate.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { channel: whereText }] } : {}, include: { deliveries: true }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "audit-center": return prisma.auditLog.findMany({ where: search ? { OR: [{ action: whereText }, { entity: whereText }, { entityId: whereText }] } : {}, orderBy: { createdAt: "desc" }, take: 100 });
    case "enterprise-search": return prisma.enterpriseSearchIndex.findMany({ where: search ? { OR: [{ title: whereText }, { content: whereText }, { entity: whereText }] } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
    case "file-center": return prisma.fileCenterDocument.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { category: whereText }] } : {}, include: { versions: true }, orderBy: { updatedAt: "desc" }, take: 100 });
    case "bi-analytics": return prisma.bIInsight.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { metric: whereText }, { audience: whereText }] } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
    case "ai-center": return prisma.aIPromptLibraryItem.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { category: whereText }] } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
    case "api-gateway": return prisma.apiGatewayEndpoint.findMany({ where: search ? { OR: [{ code: whereText }, { path: whereText }, { version: whereText }] } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
    case "monitoring": return prisma.monitoringMetric.findMany({ where: search ? { OR: [{ source: whereText }, { metric: whereText }, { status: whereText }] } : {}, orderBy: { capturedAt: "desc" }, take: 100 });
    case "security": return prisma.securityPolicy.findMany({ where: search ? { OR: [{ code: whereText }, { name: whereText }, { type: whereText }] } : {}, orderBy: { updatedAt: "desc" }, take: 100 });
    default: return prisma.productionAreaRecord.findMany({ where: { area: areaKey }, orderBy: { updatedAt: "desc" }, take: 100 });
  }
}

export async function createProductionRecord(formData: FormData) {
  const session = await requireAccess("manage");
  const areaKey = String(formData.get("area"));
  const area = getProductionArea(areaKey);
  if (!area) throw new Error("Unknown production area");
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const feature = String(formData.get("feature") || area.features[0]);
  if (!code || !name) throw new Error("Code and name are required");
  const config = parseJson(formData.get("config"), {});
  const now = new Date();
  switch (areaKey) {
    case "dashboard-engine": {
      const dashboard = await prisma.dashboardDefinition.upsert({ where: { code }, update: { name, audience: feature, layout: config as AnyRecord, filters: parseJson(formData.get("filters"), {}) as AnyRecord }, create: { code, name, audience: feature, layout: config as AnyRecord, filters: parseJson(formData.get("filters"), {}) as AnyRecord, createdById: session.user.id } });
      await prisma.dashboardWidget.upsert({ where: { id: `${dashboard.id}-kpi` }, update: { title: `${name} KPI`, config: { metric: "employees" }, position: { x: 0, y: 0, w: 3, h: 2 } }, create: { id: `${dashboard.id}-kpi`, dashboardId: dashboard.id, type: "KPI", title: `${name} KPI`, dataSource: "hrms.metrics", config: { metric: "employees" }, position: { x: 0, y: 0, w: 3, h: 2 } } });
      break;
    }
    case "workflow-engine": await prisma.workflowDefinition.upsert({ where: { code }, update: { name, entity: feature, trigger: "CREATE_OR_UPDATE", steps: config as AnyRecord, conditions: parseJson(formData.get("filters"), {}) as AnyRecord }, create: { code, name, entity: feature, trigger: "CREATE_OR_UPDATE", mode: feature.includes("parallel") ? "PARALLEL" : "SEQUENTIAL", steps: config as AnyRecord, conditions: parseJson(formData.get("filters"), {}) as AnyRecord, slaHours: 48 } }); break;
    case "report-designer": await prisma.reportDesign.upsert({ where: { code }, update: { name, module: feature, definition: config as AnyRecord, outputTypes: ["PDF", "EXCEL", "CSV"] }, create: { code, name, module: feature, definition: config as AnyRecord, outputTypes: ["PDF", "EXCEL", "CSV"], filters: parseJson(formData.get("filters"), {}) as AnyRecord } }); break;
    case "notification-center": await prisma.notificationTemplate.upsert({ where: { code }, update: { name, channel: feature.toUpperCase(), body: JSON.stringify(config) }, create: { code, name, channel: feature.toUpperCase(), subject: name, body: JSON.stringify(config), variables: parseJson(formData.get("filters"), {}) as AnyRecord } }); break;
    case "enterprise-search": await prisma.enterpriseSearchIndex.upsert({ where: { entity_entityId: { entity: feature, entityId: code } }, update: { title: name, content: JSON.stringify(config), keywords: parseJson(formData.get("filters"), []) as AnyRecord }, create: { entity: feature, entityId: code, title: name, content: JSON.stringify(config), keywords: parseJson(formData.get("filters"), []) as AnyRecord, url: `/enterprise-production/${areaKey}` } }); break;
    case "file-center": {
      const doc = await prisma.fileCenterDocument.upsert({ where: { code }, update: { name, category: feature, metadata: config as AnyRecord }, create: { code, name, category: feature, metadata: config as AnyRecord, currentUrl: String((config as AnyRecord).url || "") || null } });
      await prisma.fileCenterVersion.upsert({ where: { documentId_version: { documentId: doc.id, version: 1 } }, update: { fileUrl: doc.currentUrl || "/api/uploads", fileName: name }, create: { documentId: doc.id, version: 1, fileUrl: doc.currentUrl || "/api/uploads", fileName: name, approval: "APPROVED", createdById: session.user.id } });
      break;
    }
    case "bi-analytics": await prisma.bIInsight.upsert({ where: { code }, update: { name, metric: feature, value: Number((config as AnyRecord).value ?? 0), trend: config as AnyRecord }, create: { code, name, metric: feature, value: Number((config as AnyRecord).value ?? 0), trend: config as AnyRecord, forecast: parseJson(formData.get("filters"), {}) as AnyRecord, period: "CURRENT", audience: "EXECUTIVE" } }); break;
    case "ai-center": await prisma.aIPromptLibraryItem.upsert({ where: { code }, update: { name, category: feature, prompt: JSON.stringify(config) }, create: { code, name, category: feature, prompt: JSON.stringify(config), variables: parseJson(formData.get("filters"), {}) as AnyRecord } }); break;
    case "api-gateway": await prisma.apiGatewayEndpoint.upsert({ where: { code }, update: { version: "v1", method: String((config as AnyRecord).method || "GET"), path: String((config as AnyRecord).path || "/api/hr"), scopes: parseJson(formData.get("filters"), ["read:settings"]) as AnyRecord }, create: { code, version: "v1", method: String((config as AnyRecord).method || "GET"), path: String((config as AnyRecord).path || "/api/hr"), scopes: parseJson(formData.get("filters"), ["read:settings"]) as AnyRecord, rateLimit: Number((config as AnyRecord).rateLimit ?? 1000) } }); break;
    case "monitoring": await prisma.monitoringMetric.create({ data: { source: feature, metric: code, value: Number((config as AnyRecord).value ?? 1), unit: String((config as AnyRecord).unit || "count"), status: String((config as AnyRecord).status || "OK"), metadata: config as AnyRecord, capturedAt: now } }); break;
    case "security": await prisma.securityPolicy.upsert({ where: { code }, update: { name, type: feature, rules: config as AnyRecord }, create: { code, name, type: feature, rules: config as AnyRecord } }); break;
    default: await prisma.productionAreaRecord.upsert({ where: { area_feature_code: { area: areaKey, feature, code } }, update: { name, config: config as AnyRecord }, create: { area: areaKey, feature, code, name, config: config as AnyRecord, createdById: session.user.id } });
  }
  revalidatePath(`/enterprise-production/${areaKey}`);
}

export async function deleteProductionRecord(formData: FormData) {
  await requireAccess("manage");
  const area = String(formData.get("area"));
  const id = String(formData.get("id"));
  const model = getProductionArea(area)?.model;
  if (!model) throw new Error("Unknown production area");
  await (prisma as AnyRecord)[model].delete({ where: { id } });
  revalidatePath(`/enterprise-production/${area}`);
}

export async function productionMetrics() {
  await requireAccess("read");
  const [dashboards, workflows, reports, notifications, search, files, insights, prompts, endpoints, monitoring, policies] = await Promise.all([
    prisma.dashboardDefinition.count().catch(() => 0), prisma.workflowDefinition.count().catch(() => 0), prisma.reportDesign.count().catch(() => 0), prisma.notificationTemplate.count().catch(() => 0), prisma.enterpriseSearchIndex.count().catch(() => 0), prisma.fileCenterDocument.count().catch(() => 0), prisma.bIInsight.count().catch(() => 0), prisma.aIPromptLibraryItem.count().catch(() => 0), prisma.apiGatewayEndpoint.count().catch(() => 0), prisma.monitoringMetric.count().catch(() => 0), prisma.securityPolicy.count().catch(() => 0)
  ]);
  return { dashboards, workflows, reports, notifications, search, files, insights, prompts, endpoints, monitoring, policies };
}
