"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserX, Download } from "lucide-react";

type Absentee = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  branchName: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function LeaveAbsenteeReport() {
  const [date, setDate] = useState(todayStr());
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [absentees, setAbsentees] = useState<Absentee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (departmentId) params.set("departmentId", departmentId);
    if (branchId) params.set("branchId", branchId);
    const res = await fetch(`/api/enterprise/leave/absentee?${params}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (data?.success) setAbsentees(data.absentees);
    setLoading(false);
  }, [date, departmentId, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const header = ["الرقم الوظيفي", "الاسم", "القسم", "الفرع", "نوع الإجازة", "من", "إلى"];
    const rows = absentees.map((a) => [a.employeeNumber, a.employeeName, a.departmentName ?? "", a.branchName ?? "", a.leaveTypeName, a.startDate.slice(0, 10), a.endDate.slice(0, 10)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `absentee-report-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserX className="h-4.5 w-4.5 text-primary" />كشف الموظفين الغائبين بإجازة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>القسم (اختياري، ID)</Label>
            <Input value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} placeholder="اتركه فارغاً لكل الأقسام" />
          </div>
          <div className="space-y-1.5">
            <Label>الفرع (اختياري، ID)</Label>
            <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="اتركه فارغاً لكل الفروع" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="gap-1.5 w-full" onClick={exportCsv} disabled={absentees.length === 0}>
              <Download className="h-4 w-4" />تصدير CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : absentees.length === 0 ? (
            <p className="text-center text-muted-foreground py-16 text-sm">لا يوجد موظفون غائبون بإجازة في هذا التاريخ</p>
          ) : (
            <div className="divide-y">
              {absentees.map((a) => (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-4 text-sm">
                  <div>
                    <p className="font-bold">{a.employeeName} <span className="text-muted-foreground font-normal">({a.employeeNumber})</span></p>
                    <p className="text-xs text-muted-foreground">{[a.departmentName, a.branchName].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{a.leaveTypeName}</span> · {new Date(a.startDate).toLocaleDateString("ar-SA")} → {new Date(a.endDate).toLocaleDateString("ar-SA")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
