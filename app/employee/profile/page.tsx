import { requireEmployee, getEmployeeSetting } from '@/lib/employee/portal';
import { EmployeeProfilePortal } from '@/components/employee/EmployeeProfilePortal';


export default async function ProfilePage() {
  const { employee } = await requireEmployee();
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
