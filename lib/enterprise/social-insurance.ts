import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { createEnterpriseNotification, notifyRole } from "@/lib/enterprise/notifications";
import type { SalaryProfile } from "@/lib/employee/salary-profile";
import type { SocialInsuranceMovementSource, SocialInsuranceMovementType, SocialInsuranceStatus } from "@prisma/client";

function toAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && value !== null && "toNumber" in (value as Record<string, unknown>)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

function computeContributions(subjectWage: number, employeeRate: number, employerRate: number) {
  return {
    employeeContributionAmount: Number((subjectWage * (employeeRate / 100)).toFixed(2)),
    employerContributionAmount: Number((subjectWage * (employerRate / 100)).toFixed(2))
  };
}

function serializeRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : typeof value === "object" && value !== null && "toNumber" in (value as object) ? toAmount(value) : value])
  );
}

type MovementInput = {
  recordId: string;
  employeeId: string;
  type: SocialInsuranceMovementType;
  description: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  source?: SocialInsuranceMovementSource;
  actorUserId?: string | null;
};

/** The only write path for SocialInsuranceMovement -- append-only, no
 * update/delete exposed anywhere, same discipline as AuditLog. */
export async function recordMovement(input: MovementInput) {
  return prisma.socialInsuranceMovement.create({
    data: {
      recordId: input.recordId,
      employeeId: input.employeeId,
      type: input.type,
      description: input.description,
      previousValue: (input.previousValue ?? undefined) as any,
      newValue: (input.newValue ?? undefined) as any,
      source: input.source ?? "MANUAL",
      actorUserId: input.actorUserId ?? null
    }
  });
}

export async function getSocialInsuranceRecord(employeeId: string) {
  return prisma.socialInsuranceRecord.findUnique({
    where: { employeeId },
    include: { movements: { orderBy: { createdAt: "desc" } } }
  });
}

export type SocialInsuranceUpdateInput = {
  status?: SocialInsuranceStatus;
  subscriberNumber?: string | null;
  registrationDate?: Date | null;
  exclusionDate?: Date | null;
  exclusionReason?: string | null;
  subjectWage?: number;
  currency?: string;
  employeeContributionRate?: number;
  employerContributionRate?: number;
  notes?: string | null;
};

/** Single mutation path for SocialInsuranceRecord -- creates or updates the
 * record, computes contribution amounts, writes one movement entry per
 * distinct kind of change (status transition / wage change / rate change)
 * so the ledger reads as a real history, and writes the generic AuditLog
 * before/after diff same as every other HRMS mutation. */
export async function upsertSocialInsuranceRecord({
  employeeId,
  actorUserId,
  input
}: {
  employeeId: string;
  actorUserId: string;
  input: SocialInsuranceUpdateInput;
}) {
  const existing = await prisma.socialInsuranceRecord.findUnique({ where: { employeeId } });

  const subjectWage = input.subjectWage ?? (existing ? toAmount(existing.subjectWage) : 0);
  const employeeRate = input.employeeContributionRate ?? (existing ? toAmount(existing.employeeContributionRate) : 9.0);
  const employerRate = input.employerContributionRate ?? (existing ? toAmount(existing.employerContributionRate) : 11.75);
  const { employeeContributionAmount, employerContributionAmount } = computeContributions(subjectWage, employeeRate, employerRate);

  const data = {
    status: input.status ?? existing?.status ?? ("NOT_REGISTERED" as SocialInsuranceStatus),
    subscriberNumber: input.subscriberNumber !== undefined ? input.subscriberNumber : existing?.subscriberNumber ?? null,
    registrationDate: input.registrationDate !== undefined ? input.registrationDate : existing?.registrationDate ?? null,
    exclusionDate: input.exclusionDate !== undefined ? input.exclusionDate : existing?.exclusionDate ?? null,
    exclusionReason: input.exclusionReason !== undefined ? input.exclusionReason : existing?.exclusionReason ?? null,
    subjectWage,
    currency: input.currency ?? existing?.currency ?? "SAR",
    employeeContributionRate: employeeRate,
    employerContributionRate: employerRate,
    employeeContributionAmount,
    employerContributionAmount,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    notes: input.notes !== undefined ? input.notes : existing?.notes ?? null
  };

  const record = existing
    ? await prisma.socialInsuranceRecord.update({ where: { employeeId }, data })
    : await prisma.socialInsuranceRecord.create({ data: { employeeId, ...data } });

  const movements: Array<{ type: SocialInsuranceMovementType; description: string; previousValue?: Record<string, unknown>; newValue?: Record<string, unknown> }> = [];

  const statusChanged = existing ? existing.status !== data.status : data.status !== "NOT_REGISTERED";
  if (statusChanged) {
    if (data.status === "ACTIVE" && (!existing || existing.status === "NOT_REGISTERED")) {
      movements.push({
        type: "REGISTERED",
        description: `تسجيل الموظف في التأمينات الاجتماعية${data.subscriberNumber ? ` برقم مشترك ${data.subscriberNumber}` : ""}`,
        previousValue: existing ? { status: existing.status } : undefined,
        newValue: { status: data.status, subscriberNumber: data.subscriberNumber, subjectWage }
      });
    } else if (data.status === "SUSPENDED") {
      movements.push({
        type: "SUSPENDED",
        description: "إيقاف اشتراك التأمينات الاجتماعية مؤقتاً",
        previousValue: { status: existing?.status },
        newValue: { status: data.status }
      });
    } else if (data.status === "ACTIVE" && existing?.status === "SUSPENDED") {
      movements.push({
        type: "REACTIVATED",
        description: "إعادة تفعيل اشتراك التأمينات الاجتماعية",
        previousValue: { status: existing.status },
        newValue: { status: data.status }
      });
    } else if (data.status === "EXCLUDED") {
      movements.push({
        type: "EXCLUDED",
        description: `استبعاد الموظف من التأمينات الاجتماعية${data.exclusionReason ? `: ${data.exclusionReason}` : ""}`,
        previousValue: { status: existing?.status },
        newValue: { status: data.status, exclusionDate: data.exclusionDate?.toISOString() ?? null, exclusionReason: data.exclusionReason }
      });
    }
  }

  if (existing && toAmount(existing.subjectWage) !== subjectWage) {
    movements.push({
      type: "WAGE_ADJUSTED",
      description: `تعديل الأجر الخاضع للاشتراك من ${toAmount(existing.subjectWage)} إلى ${subjectWage}`,
      previousValue: { subjectWage: toAmount(existing.subjectWage) },
      newValue: { subjectWage }
    });
  }

  if (existing && (toAmount(existing.employeeContributionRate) !== employeeRate || toAmount(existing.employerContributionRate) !== employerRate)) {
    movements.push({
      type: "RATE_CHANGED",
      description: `تعديل نسب الاشتراك (الموظف ${employeeRate}% / الجهة ${employerRate}%)`,
      previousValue: { employeeContributionRate: toAmount(existing.employeeContributionRate), employerContributionRate: toAmount(existing.employerContributionRate) },
      newValue: { employeeContributionRate: employeeRate, employerContributionRate: employerRate }
    });
  }

  if (input.notes !== undefined && input.notes !== (existing?.notes ?? null) && !movements.length) {
    movements.push({ type: "NOTE_ADDED", description: "تحديث ملاحظات ملف التأمينات الاجتماعية" });
  }

  for (const movement of movements) {
    await recordMovement({ recordId: record.id, employeeId, actorUserId, source: "MANUAL", ...movement });
  }

  await writeAuditLog({
    actorUserId,
    action: existing ? "update" : "create",
    entity: "socialInsuranceRecord",
    entityId: record.id,
    metadata: { before: existing ? serializeRecord(existing) : null, after: serializeRecord(record) }
  });

  const notifiable = movements.find((m) => m.type === "REGISTERED" || m.type === "EXCLUDED" || m.type === "SUSPENDED");
  if (notifiable) {
    await notifyRole(["SUPER_ADMIN", "HR_MANAGER"], "تحديث التأمينات الاجتماعية", notifiable.description, "INFO", `/employees/${employeeId}`).catch(() => null);
  }

  return record;
}

/** Called wherever an employee's live salary profile is saved (see
 * lib/hrms/actions.ts). Only acts if the employee already has a tracked
 * SocialInsuranceRecord -- an employee with no record is simply "not
 * registered yet", a state the dashboard already reflects correctly, so
 * there's nothing to sync until HR actually registers them. */
export async function syncSocialInsuranceFromPayroll(employeeId: string, salaryProfile: SalaryProfile, actorUserId?: string | null) {
  if (salaryProfile.salaryBase === undefined) return null;
  const existing = await prisma.socialInsuranceRecord.findUnique({ where: { employeeId } });
  if (!existing || existing.status === "NOT_REGISTERED" || existing.status === "EXCLUDED") return null;

  const newWage = Number(salaryProfile.salaryBase.toFixed(2));
  const previousWage = toAmount(existing.subjectWage);
  if (previousWage === newWage) return null;

  const employeeRate = toAmount(existing.employeeContributionRate);
  const employerRate = toAmount(existing.employerContributionRate);
  const { employeeContributionAmount, employerContributionAmount } = computeContributions(newWage, employeeRate, employerRate);

  const record = await prisma.socialInsuranceRecord.update({
    where: { employeeId },
    data: { subjectWage: newWage, employeeContributionAmount, employerContributionAmount, lastSyncedAt: new Date() }
  });

  await recordMovement({
    recordId: record.id,
    employeeId,
    type: "WAGE_ADJUSTED",
    description: `مزامنة تلقائية من الرواتب: تعديل الأجر الخاضع للاشتراك من ${previousWage} إلى ${newWage}`,
    previousValue: { subjectWage: previousWage },
    newValue: { subjectWage: newWage },
    source: "PAYROLL_SYNC",
    actorUserId: actorUserId ?? null
  });

  return record;
}

export async function getSocialInsuranceStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalEmployees, byStatus, wageAgg, salaryChangesThisMonth] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.socialInsuranceRecord.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.socialInsuranceRecord.aggregate({
      where: { status: "ACTIVE" },
      _sum: { subjectWage: true, employeeContributionAmount: true, employerContributionAmount: true }
    }),
    prisma.socialInsuranceMovement.count({ where: { type: "WAGE_ADJUSTED", createdAt: { gte: monthStart } } })
  ]);

  const statusCounts: Record<SocialInsuranceStatus, number> = { NOT_REGISTERED: 0, ACTIVE: 0, SUSPENDED: 0, EXCLUDED: 0 };
  for (const row of byStatus) statusCounts[row.status] = row._count._all;

  const registered = statusCounts.ACTIVE + statusCounts.SUSPENDED + statusCounts.EXCLUDED;
  const notRegistered = Math.max(totalEmployees - registered, 0);

  return {
    totalEmployees,
    registered,
    notRegistered,
    activeSubscribers: statusCounts.ACTIVE,
    suspended: statusCounts.SUSPENDED,
    excluded: statusCounts.EXCLUDED,
    salaryChangesThisMonth,
    totalSubjectWages: toAmount(wageAgg._sum.subjectWage),
    employeeContributionTotal: toAmount(wageAgg._sum.employeeContributionAmount),
    employerContributionTotal: toAmount(wageAgg._sum.employerContributionAmount)
  };
}

/** HR-wide compliance alerts, lazily generated -- mirrors
 * ensureExpiryNotificationsForUser's on-request/dedupe'd pattern (see
 * lib/enterprise/notifications.ts), called from the same notifications-list
 * route, but scoped to SUPER_ADMIN/HR_MANAGER since these are org-wide GOSI
 * conditions, not a single employee's own expiring documents. */
export async function ensureSocialInsuranceAlertsForUser(userId: string, roles: string[]) {
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) return;

  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  const unregisteredCount = await prisma.employee.count({
    where: { status: "ACTIVE", OR: [{ socialInsuranceRecord: null }, { socialInsuranceRecord: { status: "NOT_REGISTERED" } }] }
  });
  if (unregisteredCount > 0) {
    await createEnterpriseNotification({
      userId,
      title: "تسجيل تأمينات اجتماعية مطلوب",
      body: `يوجد ${unregisteredCount} موظف نشط بدون تسجيل في التأمينات الاجتماعية.`,
      type: "WARNING",
      link: "/social-insurance",
      dedupe: true
    });
  }

  const expiringContracts = await prisma.employeeContract.findMany({
    where: { status: "ACTIVE", endDate: { gte: now, lte: soon }, employee: { socialInsuranceRecord: { status: "ACTIVE" } } },
    select: { title: true, endDate: true, employee: { select: { id: true, firstName: true, lastName: true } } }
  });
  for (const contract of expiringContracts) {
    await createEnterpriseNotification({
      userId,
      title: "مراجعة تأمينات اجتماعية قبل انتهاء العقد",
      body: `عقد ${contract.employee.firstName} ${contract.employee.lastName} ينتهي في ${contract.endDate?.toISOString().slice(0, 10)} -- راجع حالة التأمينات الاجتماعية قبل الانتهاء.`,
      type: "WARNING",
      link: `/employees/${contract.employee.id}`,
      dedupe: true
    });
  }
}
