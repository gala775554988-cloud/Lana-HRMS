"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarClock, UserX, AlertTriangle, Activity, PieChart as PieChartIcon, PlusCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StatusCounts = { DRAFT: number; PENDING: number; APPROVED: number; REJECTED: number; CANCELLED: number };
type DashboardData = {
  statusCounts: StatusCounts;
  absentToday: number;
  lowBalanceCount: number;
  upcoming: Array<{ id: string; employeeName: string; employeeNumber: string; leaveTypeName: string; startDate: string; endDate: string }>;
  typeBreakdown: Array<{ name: string; requestCount: number; totalDays: number }>;
  recentActivity: Array<{ id: string; action: string; requestId: string | null; actorName: string; createdAt: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING: "قيد الانتظار",
  APPROVED: "معتمدة",
  REJECTED: "مرفوضة",
  CANCELLED: "ملغاة"
};

const ACTION_LABEL: Record<string, string> = {
  create: "طلب جديد",
  "workflow:approve": "اعتماد",
  "workflow:reject": "رفض",
  "workflow:return": "إرجاع",
  "leave:cancel": "إلغاء"
};

export function LeaveDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/enterprise/leave/dashboard", { cache: "no-store" })
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
    return <p className="text-center text-muted-foreground py-16">تعذر تحميل لوحة معلومات الإجازات</p>;
  }

  const { statusCounts, absentToday, lowBalanceCount, upcoming, typeBreakdown, recentActivity } = data;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />نظرة عامة على الإجازات</h2>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/leaves?tab=leave-requests"><PlusCircle className="h-4 w-4" />طلبات الإجازات</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map((status) => (
          <Card key={status} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-semibold">{STATUS_LABEL[status]}</p>
              <p className="text-2xl font-black mt-1">{statusCounts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">غائبون اليوم بإجازة معتمدة</p>
              <p className="text-lg font-black mt-0.5">{absentToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/40">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">موظفون برصيد منخفض/سالب</p>
              <p className="text-lg font-black mt-0.5">{lowBalanceCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {typeBreakdown.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><PieChartIcon className="h-4.5 w-4.5 text-primary" />الإجازات حسب النوع (هذا العام)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBreakdown} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="totalDays" name="عدد الأيام" fill="#2ED3C6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4.5 w-4.5 text-primary" />الإجازات القادمة</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {upcoming.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">لا توجد إجازات معتمدة قادمة</p>
            ) : (
              upcoming.map((leave) => (
                <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-xl border p-3 text-sm">
                  <div>
                    <span className="font-bold">{leave.employeeName}</span>
                    <span className="text-muted-foreground text-xs mr-2">({leave.leaveTypeName})</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(leave.startDate).toLocaleDateString("ar-SA")} → {new Date(leave.endDate).toLocaleDateString("ar-SA")}
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
                <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-xl border p-3 text-sm">
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
