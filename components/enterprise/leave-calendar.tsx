"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";

type CalendarLeave = {
  id: string;
  startDate: string;
  endDate: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
};

const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const WEEKDAY_NAMES = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const TYPE_COLOR: Record<string, string> = {
  ANNUAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  SICK: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  EMERGENCY: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function LeaveCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [leaves, setLeaves] = useState<CalendarLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (departmentId) params.set("departmentId", departmentId);
    if (branchId) params.set("branchId", branchId);
    const res = await fetch(`/api/enterprise/leave/calendar?${params}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (data?.success) setLeaves(data.leaves);
    setLoading(false);
  }, [year, month, departmentId, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  function shiftMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  }

  const leavesByDay = useMemo(() => {
    const map = new Map<string, CalendarLeave[]>();
    for (const leave of leaves) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      while (cursor <= endUtc) {
        const key = toDateKey(cursor);
        const list = map.get(key) ?? [];
        list.push(leave);
        map.set(key, list);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return map;
  }, [leaves]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0));
    const leadingBlanks = firstDay.getUTCDay();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push({ date: null });
    for (let d = 1; d <= lastDay.getUTCDate(); d++) cells.push({ date: new Date(Date.UTC(year, month - 1, d)) });
    return cells;
  }, [year, month]);

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>تقويم الإجازات — {MONTH_NAMES[month - 1]} {year}</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => shiftMonth(-1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}>اليوم</Button>
              <Button size="icon" variant="outline" onClick={() => shiftMonth(1)}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>القسم (اختياري، ID)</Label>
              <Input value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} placeholder="اتركه فارغاً لكل الأقسام" />
            </div>
            <div className="space-y-1.5">
              <Label>الفرع (اختياري، ID)</Label>
              <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="اتركه فارغاً لكل الفروع" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-1.5 min-w-[560px]">
                {WEEKDAY_NAMES.map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-muted-foreground py-2">{day}</div>
                ))}
                {monthCells.map((cell, index) => {
                  if (!cell.date) return <div key={`blank-${index}`} />;
                  const key = toDateKey(cell.date);
                  const dayLeaves = leavesByDay.get(key) ?? [];
                  const isToday = key === toDateKey(today);
                  return (
                    <div key={key} className={`min-h-24 rounded-xl border p-1.5 ${isToday ? "border-primary bg-primary/5" : ""}`}>
                      <p className="text-xs font-bold text-muted-foreground">{cell.date.getUTCDate()}</p>
                      <div className="space-y-1 mt-1">
                        {dayLeaves.slice(0, 3).map((leave) => (
                          <div key={leave.id} className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_COLOR[leave.leaveTypeCode] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`} title={`${leave.employeeName} - ${leave.leaveTypeName}`}>
                            {leave.employeeName}
                          </div>
                        ))}
                        {dayLeaves.length > 3 ? <p className="text-[10px] text-muted-foreground">+{dayLeaves.length - 3} أخرى</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
