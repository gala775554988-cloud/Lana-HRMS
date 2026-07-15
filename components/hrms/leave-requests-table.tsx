"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Check, Clock3, RotateCcw, X, CalendarCheck2, CalendarClock, CalendarX2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";

type LeaveRequestRow = {
  id: string;
  employee?: { firstName?: string; lastName?: string; employeeNumber?: string } | null;
  leaveType?: { name?: string } | null;
  startDate?: string;
  endDate?: string;
  days?: number | string;
  status: string;
  _workflowId?: string;
  _canAct?: boolean;
};

type Stats = { pending: number; todayApprovals: number; approved: number; rejected: number };

const statusMeta: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "مسودة", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  PENDING: { label: "بانتظار الموافقة", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  APPROVED: { label: "معتمدة", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  REJECTED: { label: "مرفوضة", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  CANCELLED: { label: "ملغاة", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" }
};

function formatArabicDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
}

export function LeaveRequestsTable({
  records,
  stats,
  page,
  pageCount,
  total,
  prevHref,
  nextHref
}: {
  records: LeaveRequestRow[];
  stats: Stats;
  page: number;
  pageCount: number;
  total: number;
  prevHref: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const decide = useCallback((workflowId: string, decision: "APPROVE" | "REJECT" | "RETURN") => {
    startTransition(async () => {
      await fetch(`/api/enterprise/workflows/${workflowId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });
      router.refresh();
    });
  }, [router]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="إجمالي الطلبات" value={total} icon={CalendarDays} description="كل طلبات الإجازات" />
        <StatCard title="بانتظار الموافقة" value={stats.pending} icon={CalendarClock} description="طلبات معلقة حالياً" />
        <StatCard title="اعتمادات اليوم" value={stats.todayApprovals} icon={CalendarCheck2} description="تمت الموافقة عليها اليوم" />
        <StatCard title="مرفوضة" value={stats.rejected} icon={CalendarX2} description="إجمالي الطلبات المرفوضة" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead className="bg-indigo-50/70 text-indigo-950 dark:bg-indigo-950/20 dark:text-indigo-100">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">الموظف</th>
                <th className="px-4 py-3 text-start font-semibold">نوع الإجازة</th>
                <th className="px-4 py-3 text-start font-semibold">تاريخ البداية</th>
                <th className="px-4 py-3 text-start font-semibold">تاريخ النهاية</th>
                <th className="px-4 py-3 text-start font-semibold">عدد الأيام</th>
                <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                <th className="px-4 py-3 text-start font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const meta = statusMeta[record.status] ?? statusMeta.DRAFT;
                const employeeName = record.employee ? `${record.employee.firstName ?? ""} ${record.employee.lastName ?? ""}`.trim() : "-";
                return (
                  <tr key={record.id} className="border-t border-slate-100 transition-colors hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/20">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{employeeName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{record.employee?.employeeNumber ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 align-top">{record.leaveType?.name ?? "-"}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">{formatArabicDate(record.startDate)}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">{formatArabicDate(record.endDate)}</td>
                    <td className="px-4 py-3 align-top">{record.days ?? "-"}</td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                        <Clock3 className="h-3 w-3" />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {record._canAct && record._workflowId ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400" disabled={isPending} onClick={() => decide(record._workflowId!, "APPROVE")}>
                              <Check className="h-3.5 w-3.5" />موافقة
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10" disabled={isPending} onClick={() => decide(record._workflowId!, "REJECT")}>
                              <X className="h-3.5 w-3.5" />رفض
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" disabled={isPending} onClick={() => decide(record._workflowId!, "RETURN")}>
                              <RotateCcw className="h-3.5 w-3.5" />إرجاع
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">لا توجد طلبات إجازات</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>صفحة {page} من {pageCount} - {total} سجل</span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link href={prevHref}>السابق</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={nextHref}>التالي</Link></Button>
        </div>
      </div>
    </div>
  );
}
