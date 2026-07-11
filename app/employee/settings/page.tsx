import { requireEmployee, getEmployeeSetting } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { EmployeeSettingsPortal } from '@/components/employee/EmployeeSettingsPortal';
export default async function SettingsPage(){const {employee}=await requireEmployee(); const [settings,sessions]=await Promise.all([getEmployeeSetting(employee.id,'securitySettings',{}), employee.userId?prisma.session.findMany({where:{userId:employee.userId},orderBy:{expires:'desc'},take:10}):[]]); return <EmployeeSettingsPortal settings={settings} sessions={sessions as any[]} user={employee.user as any}/>}
