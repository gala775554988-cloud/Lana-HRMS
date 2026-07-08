'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getErpSuite, titleFromSlug } from "@/lib/enterprise-erp/catalog";

type JsonObject = Record<string, unknown>;

async function requireAccess(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

function validate(suite: string, feature: string) {
  const meta = getErpSuite(suite);
  if (!meta || !meta.features.includes(feature as never)) throw new Error("Unknown ERP feature");
  return meta;
}

function parseJson(value: FormDataEntryValue | null, fallback: JsonObject = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  try { return JSON.parse(raw) as JsonObject; } catch { return { text: raw }; }
}

export async function listErpRecords(suite: string, feature: string, search = "") {
  await requireAccess("read");
  validate(suite, feature);
  const needle = search ? { contains: search, mode: "insensitive" as const } : undefined;
  return prisma.enterprisePlatformRecord.findMany({
    where: { suite, feature, ...(search ? { OR: [{ code: needle }, { name: needle }, { status: needle }] } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
}

export async function saveErpRecord(formData: FormData) {
  const session = await requireAccess("manage");
  const suite = String(formData.get("suite") || "");
  const feature = String(formData.get("feature") || "");
  validate(suite, feature);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!code || !name) throw new Error("Code and name are required");
  const payload = parseJson(formData.get("payload"));
  const workflow = parseJson(formData.get("workflow"), { steps: [{ type: "approval", role: "MANAGER" }], mode: "SEQUENTIAL" });
  const metrics = parseJson(formData.get("metrics"), { score: 0 });
  const existing = await prisma.enterprisePlatformRecord.findFirst({ where: { tenantId: null, suite, feature, code } });
  if (existing) {
    await prisma.enterprisePlatformRecord.update({
      where: { id: existing.id },
      data: { name, status: String(formData.get("status") || "ACTIVE"), priority: String(formData.get("priority") || "NORMAL"), payload: payload as any, workflow: workflow as any, metrics: metrics as any }
    });
  } else {
    await prisma.enterprisePlatformRecord.create({
      data: { suite, feature, code, name, status: String(formData.get("status") || "ACTIVE"), priority: String(formData.get("priority") || "NORMAL"), payload: payload as any, workflow: workflow as any, metrics: metrics as any, createdById: session.user.id }
    });
  }
  await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: "enterprise-erp:save", entity: `${suite}/${feature}`, entityId: code, metadata: payload as any } }).catch(() => null);
  revalidatePath(`/enterprise-erp/${suite}/${feature}`);
}

export async function deleteErpRecord(formData: FormData) {
  await requireAccess("manage");
  const id = String(formData.get("id"));
  const record = await prisma.enterprisePlatformRecord.delete({ where: { id } });
  revalidatePath(`/enterprise-erp/${record.suite}/${record.feature}`);
}

export async function erpMetrics() {
  await requireAccess("read");
  const [records, tenants, openApi, jobs, health] = await Promise.all([
    prisma.enterprisePlatformRecord.count().catch(() => 0),
    prisma.tenant.count().catch(() => 0),
    prisma.openApiDocument.count().catch(() => 0),
    prisma.platformBackgroundJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }).catch(() => 0),
    prisma.platformHealthMetric.count({ where: { status: "OK" } }).catch(() => 0),
  ]);
  return { records, tenants, openApi, jobs, health };
}

export async function ensureOpenApiDocument() {
  const spec = {
    openapi: "3.1.0",
    info: { title: "Lana Enterprise Public API", version: "v1" },
    paths: {
      "/api/public/v1/{suite}/{feature}": { get: { summary: "List enterprise records" }, post: { summary: "Create enterprise record" } },
      "/api/graphql": { post: { summary: "GraphQL endpoint" } },
      "/api/health": { get: { summary: "Health check" } }
    }
  };
  return prisma.openApiDocument.upsert({ where: { version_title: { version: "v1", title: "Lana Enterprise Public API" } }, update: { spec: spec as any }, create: { version: "v1", title: "Lana Enterprise Public API", spec: spec as any } });
}

export async function seedTenantRecord(formData: FormData) {
  await requireAccess("manage");
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!code || !name) throw new Error("Code and name are required");
  await prisma.tenant.upsert({ where: { code }, update: { name, domain: String(formData.get("domain") || "") || null, branding: parseJson(formData.get("branding")) as any, settings: parseJson(formData.get("settings")) as any }, create: { code, name, domain: String(formData.get("domain") || "") || null, branding: parseJson(formData.get("branding")) as any, settings: parseJson(formData.get("settings")) as any } });
  revalidatePath("/enterprise-erp/multi-tenancy/tenant-isolation");
}

export { titleFromSlug };
