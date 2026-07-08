'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getPhase2Suite, titleFromSlug } from "@/lib/phase2/catalog";

export type Phase2Record = {
  id: string;
  code: string;
  name: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function requirePhase2(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}

function settingKey(suite: string, feature: string) {
  return `PHASE2_PRODUCTION_${suite}_${feature}`.toUpperCase();
}

function parseRecords(value: unknown): Phase2Record[] {
  if (Array.isArray(value)) return value as Phase2Record[];
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown }).records)) return (value as { records: Phase2Record[] }).records;
  return [];
}

function validate(suite: string, feature: string) {
  const meta = getPhase2Suite(suite);
  if (!meta || !meta.features.includes(feature as never)) throw new Error("Unknown production feature");
  return meta;
}

export async function listPhase2Records(suite: string, feature: string, search = "") {
  await requirePhase2("read");
  validate(suite, feature);
  const setting = await prisma.appSetting.findUnique({ where: { key: settingKey(suite, feature) } }).catch(() => null);
  const rows = parseRecords(setting?.value);
  const needle = search.trim().toLowerCase();
  return needle ? rows.filter((row) => [row.code, row.name, row.status, JSON.stringify(row.payload)].join(" ").toLowerCase().includes(needle)) : rows;
}

export async function savePhase2Record(formData: FormData) {
  await requirePhase2("manage");
  const suite = String(formData.get("suite") || "");
  const feature = String(formData.get("feature") || "");
  validate(suite, feature);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const status = String(formData.get("status") || "ACTIVE");
  if (!code || !name) throw new Error("Code and name are required");
  let payload: Record<string, unknown> = {};
  const rawPayload = String(formData.get("payload") || "{}").trim();
  try { payload = JSON.parse(rawPayload || "{}"); } catch { payload = { notes: rawPayload }; }
  const key = settingKey(suite, feature);
  const existing = await prisma.appSetting.findUnique({ where: { key } }).catch(() => null);
  const rows = parseRecords(existing?.value);
  const now = new Date().toISOString();
  const current = rows.find((row) => row.code === code);
  const next: Phase2Record = { id: current?.id || `${suite}-${feature}-${code}`, code, name, status, payload, createdAt: current?.createdAt || now, updatedAt: now };
  const updated = [...rows.filter((row) => row.code !== code), next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const value = { suite, feature, title: titleFromSlug(feature), records: updated } as any;
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value, description: `${suite}/${feature}` }
  });
  await prisma.auditLog.create({ data: { actorUserId: (await auth())?.user?.id, action: "phase2:save", entity: `${suite}/${feature}`, entityId: code, metadata: payload as any } }).catch(() => null);
  revalidatePath(`/phase2-production/${suite}/${feature}`);
}

export async function deletePhase2Record(formData: FormData) {
  await requirePhase2("manage");
  const suite = String(formData.get("suite") || "");
  const feature = String(formData.get("feature") || "");
  const code = String(formData.get("code") || "");
  validate(suite, feature);
  const key = settingKey(suite, feature);
  const existing = await prisma.appSetting.findUnique({ where: { key } }).catch(() => null);
  const rows = parseRecords(existing?.value).filter((row) => row.code !== code);
  const value = { suite, feature, title: titleFromSlug(feature), records: rows } as any;
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value, description: `${suite}/${feature}` } });
  revalidatePath(`/phase2-production/${suite}/${feature}`);
}

export async function phase2Metrics() {
  await requirePhase2("read");
  const settings = await prisma.appSetting.findMany({ where: { key: { startsWith: "PHASE2_PRODUCTION_" } } }).catch(() => []);
  const records = settings.reduce((sum, item) => sum + parseRecords(item.value).length, 0);
  return { settings: settings.length, records };
}
