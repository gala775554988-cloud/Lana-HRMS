import Link from "next/link";
import { requireEmployee, asNumber, fmtDate } from "@/lib/employee/portal";
import { getAvailableLeaveBalance } from "@/lib/employee/leave-balance";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "معتمدة",
  REJECTED: "مرفوضة",
  CANCELLED: "ملغاة",
  RETURNED: "معادة للتعديل",
};

export default async function LeavePage() {
  const { employee } = await requireEmployee();
  const [balance, requests] = await Promise.all([
    getAvailableLeaveBalance(employee.id),
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      include: { leaveType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6" dir="rtl">
      <header className="lana-workspace-hero flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
        <div>
          <h1 className="text-3xl">الإجازات</h1>
          <p className="mt-2 text-sm text-slate-200">راجع رصيدك السنوي وتابع طلباتك.</p>
        </div>
        <Button asChild variant="secondary"><Link href="/employee/requests">طلب إجازة ومتابعته</Link></Button>
      </header>
      <section aria-label="رصيد الإجازة السنوية" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ["الرصيد السنوي", balance.accrued],
          ["المستخدم", balance.used],
          ["محجوز للطلبات المعلقة", balance.reserved],
          ["المتاح للطلب", balance.available],
        ].map(([label, value]) => (
          <Card key={label}><CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value} <span className="text-sm">يوم</span></p>
          </CardContent></Card>
        ))}
      </section>
      <Card>
        <CardHeader><CardTitle>آخر طلبات الإجازة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات إجازة بعد.</p>}
          {requests.map(request => (
            <article key={request.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4">
              <div>
                <p className="font-semibold">{request.leaveType.name} · {asNumber(request.days)} يوم</p>
                <p className="mt-1 text-sm text-muted-foreground">{fmtDate(request.startDate)} – {fmtDate(request.endDate)}</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-sm">{statusLabels[request.status] ?? request.status}</span>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
