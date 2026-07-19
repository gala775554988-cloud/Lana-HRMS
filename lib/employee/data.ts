import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { EmployeeProfile } from "@/types/employee";
import { cache } from "react";

// Cached version to prevent duplicate queries
export const getCurrentEmployee = cache(async () => {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        employeeNumber: true,
        nationalId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profilePhotoUrl: true,
        hireDate: true,
        status: true,
        department: { select: { name: true, code: true } },
        position: { select: { title: true } },
        branch: { select: { name: true } },
      },
    });

    if (!employee) return null;

    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      nationalId: employee.nationalId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      profilePhotoUrl: employee.profilePhotoUrl,
      department: employee.department,
      position: employee.position,
      branch: employee.branch,
      hireDate: employee.hireDate,
      status: employee.status,
    } as EmployeeProfile;
  } catch (error) {
    console.error("[getCurrentEmployee] Error:", error);
    return null;
  }
});
export const getPayrollSummary = cache(async (employeeId: string) => {
  const row = await prisma.payrollItem.findFirst({
    where: { employeeId },
    select: {
      baseSalary: true,
      allowanceTotal: true,
      deductionTotal: true,
      overtimeTotal: true,
      netPay: true,
      currency: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) {
    return { baseSalary: 0, allowanceTotal: 0, deductionTotal: 0, overtimeTotal: 0, netPay: 0, currency: 'SAR', lastPayDate: null as string | null };
  }
  return {
    baseSalary: Number(row.baseSalary ?? 0),
    allowanceTotal: Number(row.allowanceTotal ?? 0),
    deductionTotal: Number(row.deductionTotal ?? 0),
    overtimeTotal: Number(row.overtimeTotal ?? 0),
    netPay: Number(row.netPay ?? 0),
    currency: row.currency || 'SAR',
    lastPayDate: row.createdAt.toISOString().slice(0, 10),
  };
});

export const getRecentNotifications = cache(async (employeeId: string) => {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  return prisma.notification.findMany({
    where: { OR: [{ userId: employee?.userId ?? undefined }, { userId: null }] },
    select: { id: true, title: true, body: true, type: true, link: true, readAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
});

type RecentTask = { id: string; title: string; status: string; dueDate: string | null };

export const getRecentTasks = cache(async (employeeId: string): Promise<RecentTask[]> => {
  const db = prisma as any;
  const rows = await (db.employeePortalTask?.findMany?.({
    where: { employeeId },
    select: { id: true, title: true, status: true, dueDate: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  }) ?? Promise.resolve([]));
  return rows.map((task: any): RecentTask => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate?.toISOString?.().slice(0, 10) ?? null,
  }));
});
