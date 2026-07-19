import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarCheck2, Plus, ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { fmtDate } from "@/lib/employee/portal";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  RETURNED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "تم الاعتماد والمباشرة",
  REJECTED: "مرفوض",
  PENDING: "قيد المراجعة والاعتماد",
  RETURNED: "أُرجع للتعديل",
};

const TYPE_LABEL: Record<string, string> = {
  AFTER_LEAVE: "بعد إجازة سنوية / اعتيادية",
  AFTER_SICK: "بعد إجازة مرضية",
  AFTER_MISSION: "بعد مهمة عمل / انتداب",
  OTHER: "أخرى",
};

export default async function ResumptionPage() {
  const employee = await getCurrentEmployeeCached();
  if (!employee) {
    return <div className="p-8 text-center text-rose-600 font-bold">لم يتم العثور على بيانات الموظف</div>;
  }

  const requests = await prisma.resumptionRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: "desc" },
    take: 30
  }).catch(() => []);

  return (
    <main className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-teal-300">
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">طلبات المباشرة بعد الإجازة</h1>
            <p className="text-xs text-white/75 font-semibold mt-0.5">تقديم وتتبع طلبات إثبات العودة للعمل بعد انتهاء الإجازة وسير اعتماداتها</p>
          </div>
        </div>
        <Button asChild className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-black rounded-2xl h-11 px-6 shadow-lg shadow-teal-500/25">
          <Link href="/employee/resumption/new">
            <Plus className="h-4 w-4 me-2" />
            <span>تقديم طلب مباشرة عمل جديد</span>
          </Link>
        </Button>
      </div>

      <Card className="rounded-3xl border border-slate-200/80 shadow-md dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold">سجل طلبات المباشرة السابقة</CardTitle>
          <CardDescription>قائمة بجميع طلبات مباشرة العمل التي قدمتها وتتبع حالتها مع المعتمدين</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border p-4.5 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base">{TYPE_LABEL[r.resumptionType] || r.resumptionType}</span>
                  <Badge variant="outline" className={`text-xs font-bold rounded-xl px-3 py-0.5 border ${STATUS_BADGE[r.status] || "bg-slate-100 text-slate-700"}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  تاريخ المباشرة الفعلية: <span className="font-black text-slate-800 dark:text-slate-200">{fmtDate(r.returnDate)}</span>
                  {r.reason ? ` · مرجع الإجازة: ${r.reason}` : ""}
                </p>
                {r.notes ? <p className="text-xs text-slate-500 mt-1 italic">ملاحظات: {r.notes}</p> : null}
              </div>
              <div className="text-xs font-mono text-muted-foreground self-end sm:self-center">
                قدم في {fmtDate(r.createdAt)}
              </div>
            </div>
          ))}
          {requests.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed p-10 text-center text-sm font-semibold text-muted-foreground">
              لا توجد طلبات مباشرة عمل مسجلة بعد. اضغط على زر (تقديم طلب مباشرة عمل جديد) بالأعلى لإصدار أول طلب.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
