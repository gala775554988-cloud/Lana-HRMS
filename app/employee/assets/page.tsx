import { requireEmployee, fmtDate } from '@/lib/employee/portal';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export const dynamic='force-dynamic';
export default async function AssetsPage(){const {employee}=await requireEmployee(); const rows=await prisma.asset.findMany({where:{assignedEmployeeId:employee.id},orderBy:{updatedAt:'desc'}}); return <main className="space-y-6" dir="rtl"><h1 className="text-3xl font-black">العهد</h1><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(a=><Card key={a.id} className="rounded-3xl"><CardHeader><CardTitle>{a.name}</CardTitle></CardHeader><CardContent><p>الفئة: {a.category}</p><p>الرقم: {a.assetTag}</p><p>الحالة: {a.status}</p><p>الاستلام: {fmtDate(a.assignedAt)}</p></CardContent></Card>)}{!rows.length&&<Card><CardContent className="p-6 text-muted-foreground">لا توجد عهد مسندة لك.</CardContent></Card>}</div></main>}
