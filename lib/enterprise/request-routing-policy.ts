import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { REQUEST_CATEGORIES, defaultRoutingRule, normalizeRequestType, type RoutingRule } from "@/config/request-routing";

export const ROUTING_SETTING_KEY = "enterprise.requestRouting.v1";
export class ApprovalRoutingError extends Error { readonly statusCode = 422; }
const stageSchema = z.object({ kind: z.enum(["DIRECT_MANAGER", "MANAGER_CHAIN", "HR", "EMPLOYEE"]), employeeId: z.string().trim().min(1).optional(), name: z.string().trim().max(100).optional() }).strict().refine(stage => stage.kind !== "EMPLOYEE" || Boolean(stage.employeeId), "يجب اختيار المعتمد للمرحلة المحددة");
export const routingRuleSchema = z.object({
  requestType: z.string().transform(normalizeRequestType).refine(type => REQUEST_CATEGORIES.some(category => category.code === type), "نوع الطلب غير صالح"),
  companyId: z.string().min(1).nullable().default(null),
  mode: z.enum(["MANAGER_HR", "HIERARCHY_HR", "HR_DIRECT", "CUSTOM"]),
  hrEmployeeId: z.string().min(1).nullable().default(null),
  maxManagerLevels: z.number().int().min(1).max(20).default(10),
  slaHours: z.number().int().min(1).max(720).default(48),
  stages: z.array(stageSchema).max(12).default([]),
}).strict().refine(rule => rule.mode !== "CUSTOM" || rule.stages.length > 0, "أضف مرحلة واحدة على الأقل");
export const routingSettingsSchema = z.object({ rules: z.array(routingRuleSchema).min(1).max(200), version: z.string().datetime().nullable() }).strict().superRefine(({ rules }, context) => {
  const seen = new Set<string>();
  for (const rule of rules) { const key = `${rule.companyId ?? "*"}:${rule.requestType}`; if (seen.has(key)) context.addIssue({ code: "custom", message: "لا يمكن تكرار نوع الطلب للشركة نفسها" }); seen.add(key); }
});
export async function getRoutingSettings() {
  const setting = await prisma.appSetting.findUnique({ where: { key: ROUTING_SETTING_KEY }, select: { value: true, updatedAt: true } });
  const raw = setting?.value as { rules?: unknown } | null;
  const parsed = z.array(routingRuleSchema).safeParse(raw?.rules);
  if (setting && !parsed.success) throw new ApprovalRoutingError("إعداد مسارات الطلبات غير صالح؛ راجع مسؤول النظام.");
  return { rules: parsed.success ? parsed.data as RoutingRule[] : REQUEST_CATEGORIES.map(category => defaultRoutingRule(category.code)), version: setting?.updatedAt.toISOString() ?? null };
}
export async function routingRuleFor(requestType: string, companyId: string | null): Promise<RoutingRule> {
  const { rules } = await getRoutingSettings();
  const type = normalizeRequestType(requestType);
  return rules.find(rule => rule.requestType === type && rule.companyId === companyId) ?? rules.find(rule => rule.requestType === type && !rule.companyId) ?? defaultRoutingRule(type);
}
