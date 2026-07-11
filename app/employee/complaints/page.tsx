import { requireEmployee } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { EmployeeComplaintsClient } from '@/components/employee/EmployeeComplaintsClient';
export default async function ComplaintsPage(){const {employee}=await requireEmployee(); const records=await (prisma as any).employeeComplaint.findMany({where:{employeeId:employee.id},orderBy:{createdAt:'desc'},take:100}); return <EmployeeComplaintsClient initialRecords={records}/>}
