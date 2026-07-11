import { requireEmployee } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { EmployeeAdvancesClient } from '@/components/employee/EmployeeAdvancesClient';
export default async function AdvancesPage(){const {employee}=await requireEmployee(); const records=await (prisma as any).employeeSalaryAdvance.findMany({where:{employeeId:employee.id},orderBy:{createdAt:'desc'},take:100}); return <EmployeeAdvancesClient initialRecords={records}/>}
