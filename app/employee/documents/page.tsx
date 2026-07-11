import { requireEmployee } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { EmployeeDocumentsPortal } from '@/components/employee/EmployeeDocumentsPortal';


export default async function DocumentsPage() {
  const { employee } = await requireEmployee();
  const documents = await prisma.employeeDocument.findMany({ where: { employeeId: employee.id }, orderBy: { uploadedAt: 'desc' }, take: 200 });
  return <EmployeeDocumentsPortal employeeId={employee.id} initialDocuments={documents as any[]} />;
}
