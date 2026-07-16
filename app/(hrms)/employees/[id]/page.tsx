import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getModuleRecord } from "@/lib/hrms/actions";
import { getEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { getEmployeeFieldAccess, redactHiddenFields } from "@/lib/enterprise/employee-field-access";
import { EmployeeProfileDashboard } from "@/components/hrms/employee-profile-dashboard";
import { PermissionsScope } from "@/components/hrms/permissions-scope";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dictionary, locale } = await getRequestDictionary();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const viewerFieldAccess = await getEmployeeFieldAccess(session.user.id, (session.user.roles as string[]) ?? []);

  // Fetch employee with all relations for header and tabs
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true, code: true } },
      position: { select: { id: true, title: true, code: true } },
      branch: { select: { id: true, name: true, code: true, city: true } },
      employmentType: { select: { name: true } },
      nationality: { select: { name: true } },
      user: { 
        select: { 
          id: true, 
          username: true, 
          email: true, 
          isActive: true, 
          lastLoginAt: true, 
          mustChangePassword: true, 
          passwordChanged: true, 
          passwordChangedAt: true,
          lastPasswordResetAt: true 
        } 
      },
      manager: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      managedEmployees: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!employee) notFound();

  // Lazy Load Details on Demand (ID-First Optimization)
  // If linked to Odoo (odooId exists), check if detailed profile (photo, birthday, custom fields) is stale (>1 hr) or missing.
  // Bounded with a timeout: this is a live external call, and an unreachable/slow Odoo
  // instance must never be able to stall the whole profile page — worst case, the
  // page renders with the last-synced data and the sync simply completes in the
  // background (or gets picked up by the ODOO_EMPLOYEE_DETAIL_SYNC queue instead).
  if (typeof employee.odooId === "number" && employee.odooId > 0) {
    const odooId = employee.odooId;
    const isStale = !employee.odooRawDataSyncedAt || (Date.now() - new Date(employee.odooRawDataSyncedAt).getTime() > 3600_000);
    if (isStale) {
      try {
        const syncWithTimeout = (async () => {
          const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
          const service = await OdooSyncService.forConnection();
          await service.syncSingleEmployeeDetails(odooId, employee.id);
        })();
        await Promise.race([
          syncWithTimeout,
          new Promise((_, reject) => setTimeout(() => reject(new Error("odoo-sync-timeout")), 1500)),
        ]);
        const refreshed = await prisma.employee.findUnique({
          where: { id },
          select: { profilePhotoUrl: true, sponsor: true, dateOfBirth: true, odooRawDataSyncedAt: true, firstName: true, lastName: true }
        });
        if (refreshed) {
          employee.profilePhotoUrl = refreshed.profilePhotoUrl;
          employee.sponsor = refreshed.sponsor;
          employee.dateOfBirth = refreshed.dateOfBirth;
          employee.odooRawDataSyncedAt = refreshed.odooRawDataSyncedAt;
          employee.firstName = refreshed.firstName;
          employee.lastName = refreshed.lastName;
        }
      } catch (err) {
        console.log(`[EmployeeProfilePage] Lazy detail load notice for odooId ${employee.odooId}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // Calculate years of service
  const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
  const now = new Date();
  let yearsOfService = "-";
  if (hireDate) {
    const diffMs = now.getTime() - hireDate.getTime();
    const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    const months = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    yearsOfService = `${years} سنة ${months} شهر`;
  }

  // Last sync with Odoo - from SyncHistory or odooWriteDate
  const lastSync = employee.updatedAt || employee.odooWriteDate || null;

  // Attendance stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // All of these are independent reads — run them in parallel instead of a
  // 10-deep sequential await chain, which was adding up to several times the
  // latency of the slowest single query.
  const [
    salaryProfile,
    attendanceStats,
    attendanceCount,
    leaveBalance,
    leaveRequests,
    contracts,
    documents,
    assets,
    evaluations,
    payrollItems,
    auditLogs,
  ] = await Promise.all([
    getEmployeeSalaryProfile(id).catch(() => null),
    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { employeeId: id, workDate: { gte: thirtyDaysAgo } },
      _count: true,
    }).catch(() => []),
    prisma.attendanceRecord.count({ where: { employeeId: id } }).catch(() => 0),
    prisma.leaveType.findMany({ select: { id: true, name: true, annualLimit: true } }).catch(() => []),
    prisma.leaveRequest.findMany({
      where: { employeeId: id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { leaveType: { select: { name: true } } }
    }).catch(() => []),
    prisma.employeeContract.findMany({
      where: { employeeId: id },
      orderBy: { startDate: 'desc' },
      take: 10,
    }).catch(() => []),
    prisma.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { uploadedAt: 'desc' },
      take: 10,
    }).catch(() => []),
    prisma.asset.findMany({
      where: { assignedEmployeeId: id },
      orderBy: { assignedAt: 'desc' },
      take: 10,
    }).catch(() => []),
    prisma.performanceEvaluation.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []),
    prisma.payrollItem.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { payrollRun: { select: { name: true, period: true } } }
    }).catch(() => []),
    prisma.auditLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),
  ]);

  // Server-side redaction: a HIDDEN field is nulled out here, before it ever
  // reaches the client bundle -- not just visually hidden in the dashboard
  // component, which would still leak the real value over the network.
  const visibleEmployee = redactHiddenFields(employee as unknown as Record<string, unknown>, viewerFieldAccess);

  return (
    <EmployeeProfileDashboard
      employee={visibleEmployee as any}
      salaryProfile={salaryProfile}
      yearsOfService={yearsOfService}
      lastSync={lastSync}
      attendanceStats={attendanceStats as any}
      attendanceCount={attendanceCount}
      leaveBalance={leaveBalance as any}
      leaveRequests={leaveRequests as any}
      contracts={contracts as any}
      documents={documents as any}
      assets={assets as any}
      evaluations={evaluations as any}
      payrollItems={payrollItems as any}
      auditLogs={auditLogs as any}
      permissionsScopeContent={<PermissionsScope employeeId={id} />}
      dictionary={dictionary}
      locale={locale}
    />
  );
}
