import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { resolveRoleEmployeeIds } from "@/lib/enterprise/hierarchy";
import { createEnterpriseNotification } from "@/lib/enterprise/notifications";
import { getEmployeeSalaryProfile, calculateNetSalary } from "@/lib/employee/salary-profile";
import { writeAuditLog } from "@/lib/audit";

export function canManageOvertime(session: any) {
  const roles = (session?.user?.roles as string[]) ?? [];
  const permissions = (session?.user?.permissions as string[]) ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "manage", resource: "overtime" });
}

export function calculateHours(startTime: string, endTime: string, fallback?: number) {
  if (!startTime || !endTime) return Number(fallback ?? 0);
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((part) => Number.isNaN(part))) return Number(fallback ?? 0);
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Number((minutes / 60).toFixed(2));
}

export function overtimeMultiplier(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("holiday") || normalized.includes("عطلة") || normalized.includes("weekend")) return 2;
  if (normalized.includes("night") || normalized.includes("ليل")) return 1.75;
  return 1.5;
}

export async function calculateOvertimeAmount(employeeId: string, hours: number, type: string) {
  const salary = await getEmployeeSalaryProfile(employeeId);
  const monthlySalary = calculateNetSalary(salary);
  const hourlyRate = monthlySalary > 0 ? monthlySalary / 240 : 0;
  return Number((hourlyRate * hours * overtimeMultiplier(type)).toFixed(2));
}

export async function createHrOnlyWorkflow(employeeId: string, entityId: string, actorUserId: string) {
  const hrEmployees = await resolveRoleEmployeeIds(["HR_MANAGER"]);
  const approverUserIds = Array.from(new Set(hrEmployees.map((employee) => employee.userId).filter((id): id is string => Boolean(id))));
  const instance = await prisma.workflowInstance.create({
    data: {
      employeeId,
      type: "OVERTIME",
      entityId,
      status: approverUserIds.length ? "PENDING" : "COMPLETED",
      currentStep: approverUserIds.length ? 1 : 0
    }
  });
  if (approverUserIds.length) {
    await prisma.workflowStep.createMany({
      data: approverUserIds.map((approverUserId, index) => ({
        workflowInstanceId: instance.id,
        step: index + 1,
        approverUserId,
        status: index === 0 ? "PENDING" : "WAITING"
      }))
    });
    await Promise.all(approverUserIds.slice(0, 1).map((userId) => createEnterpriseNotification({ userId, title: "طلب أوفر تايم جديد", body: "يوجد طلب أوفر تايم بانتظار اعتمادك.", type: "INFO" })));
  } else {
    await prisma.overtimeRequest.update({ where: { id: entityId }, data: { status: "APPROVED" } }).catch(() => null);
  }
  await writeAuditLog({ actorUserId, action: "overtime:workflow-create", entity: "workflowInstance", entityId: instance.id, metadata: { employeeId, entityId, approverUserIds } }).catch(() => null);
  return instance;
}

/** Creates one overtime request end-to-end (record + extra-details blob + HR
 * approval workflow + audit log) -- the single write path shared by the
 * one-at-a-time form and the bulk Excel importer, so they can never drift. */
export async function createOvertimeRequest({
  employeeId,
  workDate,
  hours,
  overtimeType,
  notes,
  actorUserId,
  extra = {}
}: {
  employeeId: string;
  workDate: Date;
  hours: number;
  overtimeType: string;
  notes?: string;
  actorUserId: string;
  extra?: Record<string, unknown>;
}) {
  const amount = await calculateOvertimeAmount(employeeId, hours, overtimeType);
  const rate = overtimeMultiplier(overtimeType);

  const overtime = await prisma.overtimeRequest.create({
    data: {
      employeeId,
      workDate,
      hours,
      rate,
      reason: notes ?? "",
      status: "PENDING"
    }
  });

  await prisma.appSetting.upsert({
    where: { key: `overtime.extra.${overtime.id}` },
    update: { value: { ...extra, overtimeType, notes, amount, rate } as any },
    create: { key: `overtime.extra.${overtime.id}`, value: { ...extra, overtimeType, notes, amount, rate } as any, description: "Overtime extra details" }
  });
  await createHrOnlyWorkflow(employeeId, overtime.id, actorUserId);
  await writeAuditLog({ actorUserId, action: "overtime:create", entity: "overtimeRequest", entityId: overtime.id, metadata: { amount, hours, rate } }).catch(() => null);

  return { overtime, amount, rate };
}
