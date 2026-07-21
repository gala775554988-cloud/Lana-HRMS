"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, TrendingUp, Users, CalendarClock, Activity, FileWarning } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StatusCounts = { DRAFT: number; PROCESSING: number; APPROVED: number; PAID: number; CANCELLED: number };
type CostRow = { name: string; gross: number; net: number; employeeCount: number };
type DashboardData = {
  statusCounts: StatusCounts;
  latestRun: { id: string; name: string; period: string; status: string; totals: { gross: number; net: number; employeeCount: number } } | null;
  departmentCost: CostRow[];
  branchCost: CostRow[];
  missingData: { missingContracts: number; missingSalaryAmount: number };
  upcomingPeriods: Array<{ id: string; name: string; startDate: string; endDate: string; status: string }>;
  recentActivity: Array<{ id: string; action: string; runId: string | null; actorName: string; createdAt: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PROCESSING: "قيد المراجعة",
  APPROVED: "معتمد",
  PAID: "مصروف",
  CANCELLED: "ملغي"
};

const ACTION_LABEL: Record<string, string> = {
  create: "إنشاء مسير رواتب",
  payroll_submit: "إرسال للمراجعة",
  payroll_approve: "اعتماد المسير",
  payroll_pay: "صرف الرواتب",
  payroll_cancel: "إلغاء المسير"
};

function currency(value: number) {
  return value.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

export function PayrollDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enterprise/payroll/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setData(json?.success ? json : null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-muted-foreground py-16">تعذر تحميل لوحة معلومات الرواتب</p>;
  }

  const { statusCounts, latestRun, departmentCost, branchCost, missingData, upcomingPeriods, recentActivity } = data;
  const hasMissingData = missingData.missingContracts > 0 || missingData.missingSalaryAmount > 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(["DRAFT", "PROCESSING", "APPROVED", "PAID", "CANCELLED"] as const).map((status) => (
          <Card key={status} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-semibold">{STATUS_LABEL[status]}</p>
              <p className="text-2xl font-black mt-1">{statusCounts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {latestRun ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4.5 w-4.5 text-primary" />آخر مسير رواتب: {latestRun.name}</CardTitle>
            <CardDescription>الحالة: <Badge>{STATUS_LABEL[latestRun.status] ?? latestRun.status}</Badge></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />عدد الموظفين</p>
              <p className="text-xl font-bold mt-1">{latestRun.totals.employeeCount}</p>
            </div>
            <div className="p-4 rounded-xl border">
              <p className="text-xs text-muted-foreground">إجمالي الرواتب (Gross)</p>
              <p className="text-xl font-bold mt-1">{currency(latestRun.totals.gross)}</p>
            </div>
            <div className="p-4 rounded-xl border">
              <p className="text-xs text-muted-foreground">صافي الرواتب (Net)</p>
              <p className="text-xl font-bold mt-1 text-emerald-600">{currency(latestRun.totals.net)}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasMissingData ? (
        <Card className="rounded-2xl border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4.5 w-4.5" />بيانات ناقصة تمنع احتساب الرواتب بدقة</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {missingData.missingContracts > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white/70 dark:bg-slate-900/60 p-3 text-sm font-semibold">
                <FileWarning className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{missingData.missingContracts} موظف نشط بدون عقد عمل مسجل</span>
              </div>
            ) : null}
            {missingData.missingSalaryAmount > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white/70 dark:bg-slate-900/60 p-3 text-sm font-semibold">
                <FileWarning className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{missingData.missingSalaryAmount} موظف نشط بدون راتب أساسي فعّال</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {departmentCost.length > 0 ? (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>التكلفة حسب الإدارة (آخر مسير)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentCost} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Bar dataKey="gross" fill="#2ED3C6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : null}

        {branchCost.length > 0 ? (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>التكلفة حسب الفرع (آخر مسير)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchCost} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Bar dataKey="gross" fill="#7C6CF8" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4.5 w-4.5 text-primary" />الفترات القادمة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcomingPeriods.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد فترات رواتب مفتوحة قادمة</p>
            ) : (
              upcomingPeriods.map((period) => (
                <div key={period.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <span className="font-bold">{period.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(period.startDate).toLocaleDateString("ar-SA")} → {new Date(period.endDate).toLocaleDateString("ar-SA")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4.5 w-4.5 text-primary" />النشاط الأخير</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا يوجد نشاط بعد</p>
            ) : (
              recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <span className="font-semibold">{ACTION_LABEL[entry.action] ?? entry.action}</span>
                  <span className="text-muted-foreground text-xs">{entry.actorName} · {new Date(entry.createdAt).toLocaleString("ar-SA")}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
