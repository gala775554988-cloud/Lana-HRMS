import { requireEmployee, getEmployeeSetting, fmtDate } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import PermissionRequestClient from './permission-request-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = "force-dynamic";
export default async function PermissionsPage(){const {employee}=await requireEmployee(); const saved=await getEmployeeSetting<any[]>(employee.id,'permissionRequests',[]); const audits=await prisma.auditLog.findMany({where:{entity:'permissionRequest',metadata:{path:['employeeId'],equals:employee.id} as any},orderBy:{createdAt:'desc'},take:30}).catch(()=>[]); return <main className="space-y-6" dir="rtl"><h1 className="text-3xl font-black">الاستئذانات</h1><PermissionRequestClient initial={saved} employeeId={employee.id}/><Card><CardHeader><CardTitle>سجل سير العمل</CardTitle></CardHeader><CardContent className="space-y-2">{audits.map(a=><div key={a.id} className="rounded-2xl border p-3"><p className="font-bold">{a.action}</p><p className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</p></div>)}{!audits.length&&<p className="text-muted-foreground">لا توجد عمليات مسجلة.</p>}</CardContent></Card></main>}
