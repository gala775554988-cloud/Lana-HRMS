'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getEnterpriseFeature } from "@/lib/enterprise-suite/catalog";

async function requireAccess(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

function assertFeature(suite: string, feature: string) {
  const item = getEnterpriseFeature(suite, feature);
  if (!item) throw new Error("Unknown enterprise feature");
  return item;
}

export async function listEnterpriseRecords(suite: string, feature: string, search = "") {
  await requireAccess("read");
  assertFeature(suite, feature);
  return prisma.enterpriseRecord.findMany({
    where: {
      suite,
      feature,
      ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { title: { contains: search, mode: "insensitive" } }, { status: { contains: search, mode: "insensitive" } }] } : {})
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
}

export async function createEnterpriseRecord(formData: FormData) {
  await requireAccess("manage");
  const suite = String(formData.get("suite") || "");
  const feature = String(formData.get("feature") || "");
  assertFeature(suite, feature);
  const code = String(formData.get("code") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!code || !title) throw new Error("Code and title are required");
  const dataRaw = String(formData.get("data") || "{}").trim();
  let data: unknown = {};
  try { data = dataRaw ? JSON.parse(dataRaw) : {}; } catch { data = { notes: dataRaw }; }
  await prisma.enterpriseRecord.upsert({
    where: { suite_feature_code: { suite, feature, code } },
    update: { title, status: String(formData.get("status") || "ACTIVE"), priority: String(formData.get("priority") || "NORMAL"), data: data as object },
    create: { suite, feature, code, title, status: String(formData.get("status") || "ACTIVE"), priority: String(formData.get("priority") || "NORMAL"), data: data as object }
  });
  revalidatePath(`/enterprise-suite/${suite}/${feature}`);
}

export async function deleteEnterpriseRecord(formData: FormData) {
  await requireAccess("manage");
  const id = String(formData.get("id"));
  const record = await prisma.enterpriseRecord.delete({ where: { id } });
  revalidatePath(`/enterprise-suite/${record.suite}/${record.feature}`);
}

export async function seedWorkflowTemplate(formData: FormData) {
  await requireAccess("manage");
  const suite = String(formData.get("suite") || "");
  const feature = String(formData.get("feature") || "");
  assertFeature(suite, feature);
  await prisma.enterpriseWorkflowTemplate.upsert({
    where: { id: `${suite}-${feature}-standard` },
    update: { steps: [{ step: 1, role: "MANAGER" }, { step: 2, role: "HR_MANAGER" }], conditions: { priority: "HIGH" }, slaHours: 48, isActive: true },
    create: { id: `${suite}-${feature}-standard`, suite, feature, name: "Standard Approval", steps: [{ step: 1, role: "MANAGER" }, { step: 2, role: "HR_MANAGER" }], conditions: { priority: "HIGH" }, slaHours: 48, isActive: true }
  });
  revalidatePath(`/enterprise-suite/${suite}/${feature}`);
}
