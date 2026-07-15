import { notFound } from "next/navigation";
import { getRequestDictionary } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getModuleRecord } from "@/lib/hrms/actions";
import { getEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { EmployeeProfileDashboard } from "@/components/hrms/employee-profile-dashboard";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dictionary, locale } = await getRequestDictionary();

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
  if (typeof employee.odooId === "number" && employee.odooId > 0) {
    const isStale = !employee.odooRawDataSyncedAt || (Date.now() - new Date(employee.odooRawDataSyncedAt).getTime() > 3600_000);
    if (isStale) {
      try {
        const { OdooSyncService } = await import("@/lib/integrations/odoo/sync");
        const service = await OdooSyncService.forConnection();
        await service.syncSingleEmployeeDetails(employee.odooId, employee.id);
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

  // Salary profile
  let salaryProfile: any = null;
  try {
    salaryProfile = await getEmployeeSalaryProfile(id);
  } catch {}

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
  
  const attendanceStats = await prisma.attendanceRecord.groupBy({
    by: ['status'],
    where: { employeeId: id, workDate: { gte: thirtyDaysAgo } },
    _count: true,
  }).catch(() => []);

  const attendanceCount = await prisma.attendanceRecord.count({ where: { employeeId: id } }).catch(() => 0);
  const leaveBalance = await prisma.leaveType.findMany({ select: { id: true, name: true, annualLimit: true } }).catch(() => []);
  const leaveRequests = await prisma.leaveRequest.findMany({ 
    where: { employeeId: id }, 
    take: 5, 
    orderBy: { createdAt: 'desc' },
    include: { leaveType: { select: { name: true } } }
  }).catch(() => []);

  const contracts = await prisma.employeeContract.findMany({
    where: { employeeId: id },
    orderBy: { startDate: 'desc' },
    take: 10,
  }).catch(() => []);

  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId: id },
    orderBy: { uploadedAt: 'desc' },
    take: 10,
  }).catch(() => []);

  const assets = await prisma.asset.findMany({
    where: { assignedEmployeeId: id },
    orderBy: { assignedAt: 'desc' },
    take: 10,
  }).catch(() => []);

  const evaluations = await prisma.performanceEvaluation.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  }).catch(() => []);

  const payrollItems = await prisma.payrollItem.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { payrollRun: { select: { name: true, period: true } } }
  }).catch(() => []);

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  }).catch(() => []);

  return (
    <EmployeeProfileDashboard
      employee={employee as any}
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
      dictionary={dictionary}
      locale={locale}
    />
  );
}
