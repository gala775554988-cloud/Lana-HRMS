import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { stagesForRule, STAGE_LABELS, type RoutingRule } from "@/config/request-routing";
import { ApprovalRoutingError } from "./request-routing-policy";
import type { ResolvedApprover } from "./approval-engine";

type Requester = { id: string; userId: string | null; companyId: string | null; managerId: string | null };
export async function resolveDynamicRouting(employee: Requester, rule: RoutingRule) {
  const approvers: ResolvedApprover[] = [];
  const warnings: string[] = [];
  const seenUsers = new Set<string>(employee.userId ? [employee.userId] : []);
  const add = (userId: string, stageName: string) => {
    if (seenUsers.has(userId)) return;
    seenUsers.add(userId);
    approvers.push({ userId, stageName, isMandatory: true, capabilities: ["VIEW", "APPROVE", "REJECT"], slaHours: rule.slaHours });
  };
  async function addHumanResources(label: string) {
    let resolved = false;
    for (const role of ["HR_MANAGER", "HR", "SUPER_ADMIN"]) {
      const where: Prisma.UserWhereInput = {
        isActive: true,
        id: employee.userId ? { not: employee.userId } : undefined,
        roles: { some: { role: { name: role } } },
        ...(role !== "SUPER_ADMIN" && employee.companyId ? {
          OR: [
            { employeeProfile: { is: null } },
            { employeeProfile: { is: {
              OR: [{ companyId: employee.companyId }, { companyId: null }],
              status: { notIn: ["INACTIVE", "TERMINATED"] },
            } } },
          ],
        } : {}),
      };
      const user = await prisma.user.findFirst({ where, select: { id: true }, orderBy: { createdAt: "asc" } });
      if (user) { add(user.id, role === "SUPER_ADMIN" ? `${label} · الإدارة البديلة` : label); resolved = true; break; }
    }
    if (!resolved) throw new ApprovalRoutingError("لا يوجد مسؤول موارد بشرية أو بديل إداري نشط. حدّد المعتمد من إعداد مسارات الطلبات.");
  }
  for (const stage of stagesForRule(rule)) {
    const label = stage.name || STAGE_LABELS[stage.kind];
    if (stage.kind === "DIRECT_MANAGER" || stage.kind === "MANAGER_CHAIN") {
      let managerId = employee.managerId;
      const visited = new Set<string>([employee.id]);
      const limit = stage.kind === "DIRECT_MANAGER" ? 1 : rule.maxManagerLevels;
      for (let level = 0; managerId && level < limit; level++) {
        if (visited.has(managerId)) { warnings.push("يوجد تكرار في الهيكل الإداري؛ توقف التتبع عند آخر مدير صالح."); break; }
        visited.add(managerId);
        const manager = await prisma.employee.findUnique({ where: { id: managerId }, select: { id: true, managerId: true, status: true, user: { select: { id: true, isActive: true } } } });
        if (!manager) break;
        if (manager.user?.isActive && !["INACTIVE", "TERMINATED"].includes(manager.status)) add(manager.user.id, stage.kind === "MANAGER_CHAIN" ? `${label} · المستوى ${level + 1}` : label);
        else warnings.push("مدير غير نشط أو غير مرتبط بحساب؛ ينتقل الطلب إلى المعتمد الصالح التالي.");
        managerId = manager.managerId;
      }
      if (!employee.managerId) warnings.push("لا يوجد مدير مباشر مرتبط؛ يُحال الطلب للمرحلة التالية دون اعتماد تلقائي.");
    } else if (stage.kind === "EMPLOYEE" || rule.hrEmployeeId) {
      const targetId = stage.kind === "EMPLOYEE" ? stage.employeeId : rule.hrEmployeeId;
      const target = targetId ? await prisma.employee.findUnique({ where: { id: targetId }, select: { status: true, user: { select: { id: true, isActive: true } } } }) : null;
      if (!target?.user?.isActive || ["INACTIVE", "TERMINATED"].includes(target.status)) throw new ApprovalRoutingError(`المعتمد في مرحلة «${label}» غير مرتبط بحساب نشط.`);
      if (target.user.id === employee.userId) {
        if (stage.kind === "HR") { await addHumanResources(`${label} · بديل لتجنب الموافقة الذاتية`); continue; }
        throw new ApprovalRoutingError("لا يمكن أن يكون مقدم الطلب معتمداً لطلبه؛ اختر بديلاً.");
      }
      add(target.user.id, label);
    } else {
      await addHumanResources(label);
    }
  }
  if (!approvers.length) throw new ApprovalRoutingError("لا يوجد معتمد صالح لهذا المسار. لن يُعتمد الطلب تلقائياً؛ راجع إعداد المسار.");
  return { approvers, warnings };
}
