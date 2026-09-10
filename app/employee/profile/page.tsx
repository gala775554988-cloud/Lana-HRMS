import { requireEmployee, getEmployeeSetting } from '@/lib/employee/portal';
import { EmployeeProfilePortal } from '@/components/employee/EmployeeProfilePortal';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

async function refreshOwnOdooProfile(employee: Awaited<ReturnType<typeof requireEmployee>>['employee']) {
  if (!employee.odooId || employee.odooId <= 0) return;
  const syncedAt = employee.odooRawDataSyncedAt?.getTime() ?? 0;
  if (Date.now() - syncedAt < 60 * 60 * 1000) return;

  try {
    const syncPromise = (async () => {
      const { OdooSyncService } = await import('@/lib/integrations/odoo/sync');
      const service = await OdooSyncService.forConnection();
      await service.syncSingleEmployeeDetails(employee.odooId!, employee.id);
    })();
    await Promise.race([
      syncPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('odoo-sync-timeout')), 1500)),
    ]);

    const refreshed = await prisma.employee.findUnique({
      where: { id: employee.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        workPhone: true,
        mobilePhone: true,
        profilePhotoUrl: true,
        sponsor: true,
        employeeEnglishName: true,
        iqamahJobName: true,
        maritalStatus: true,
        gender: true,
        dateOfBirth: true,
        hireDate: true,
        address: true,
        emergencyContact: true,
        firstContractDate: true,
        workingStatus: true,
        workLocationName: true,
        costCenter: true,
        odooRawDataSyncedAt: true,
      },
    });
    if (refreshed) Object.assign(employee, refreshed);
  } catch (error) {
    console.info('[EmployeeProfile] Odoo detail refresh skipped', error instanceof Error ? error.message : String(error));
  }
}

export default async function ProfilePage() {
  const { employee } = await requireEmployee();
  await refreshOwnOdooProfile(employee);
  const [bank, family, qualifications, experiences, skills, languages] = await Promise.all([
    getEmployeeSetting(employee.id, 'bank', {}),
    getEmployeeSetting(employee.id, 'family', {}),
    getEmployeeSetting(employee.id, 'qualifications', []),
    getEmployeeSetting(employee.id, 'experiences', []),
    getEmployeeSetting(employee.id, 'skills', []),
    getEmployeeSetting(employee.id, 'languages', []),
  ]);
  return <EmployeeProfilePortal employee={employee as any} settings={{ bank, family, qualifications, experiences, skills, languages }} />;
}
