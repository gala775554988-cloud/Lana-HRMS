import Link from 'next/link';
import { requireEmployee, asNumber, fmtDate } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


export default async function SalaryPage(){
 const {employee}=await requireEmployee();
 const rows=await prisma.payrollItem.findMany({where:{employeeId:employee.id},include:{payrollRun:true},orderBy:{createdAt:'desc'},take:50});
 return <main className="space-y-6" dir="rtl"><h1 className="text-3xl font-black">الرواتب</h1>{rows.map(r=><Card key={r.id} className="rounded-3xl"><CardHeader><div className="flex items-center justify-between"><CardTitle>{r.payrollRun?.name??'راتب'} - {r.payrollRun?.period??fmtDate(r.createdAt)}</CardTitle><Button asChild variant="outline"><Link href={`/api/employee/payslip?id=${r.id}`}>تحميل PDF</Link></Button></div></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><Metric t="الأساسي" v={asNumber(r.baseSalary)}/><Metric t="البدلات" v={asNumber(r.allowanceTotal)}/><Metric t="الخصومات" v={asNumber(r.deductionTotal)}/><Metric t="الإضافي" v={asNumber(r.overtimeTotal)}/><Metric t="التأمين" v={0}/><Metric t="الضريبة" v={0}/><Metric t="صافي الراتب" v={asNumber(r.netPay)}/><Metric t="الحالة" v={r.payrollRun?.status ?? '—'}/></CardContent></Card>)}{!rows.length&&<Card><CardContent className="p-6 text-muted-foreground">لا توجد مسيرات رواتب مرتبطة بملفك.</CardContent></Card>}</main>
}
function Metric({t,v}:{t:string;v:any}){return <div className="rounded-2xl border p-4"><p className="text-xs text-muted-foreground">{t}</p><p className="font-black">{typeof v==='number'?v.toLocaleString('ar-SA'):v}</p></div>}
