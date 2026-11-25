"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { UserCheck, Archive, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ArchivedEmployee {
  id: string; employeeNumber: string; nationalId: string;
  firstName: string; lastName: string; status: string;
  profilePhotoUrl?: string | null;
  departmentName: string; positionTitle: string; branchName: string;
  archiveReason?: string | null; archivedAt?: string | null; terminationDate?: string | null;
}

export function ArchivedEmployees() {
  const [employees, setEmployees] = useState<ArchivedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/employees/archived?pageSize=24&page=${page}&summary=1`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error("Archive fetch failed");
      setEmployees(json.records || []);
      setPageCount(json.pageCount || 1);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unarchive = async (id: string) => {
    try {
      const res = await fetch("/api/employees/archive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, unarchive: true }),
      });
      const data = await res.json();
      if (data.success) { if (employees.length === 1 && page > 1) setPage(page - 1); else await fetchData(); }
      else alert(data.message);
    } catch { alert("خطأ"); }
  };

  if (loading) return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  if (error) return <Button onClick={fetchData}>تعذر التحميل، إعادة المحاولة</Button>;

  if (!employees.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Archive className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-sm font-medium">لا يوجد موظفون مؤرشفي</p>
    </div>
  );

  return (
    <div className="space-y-4"><div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {employees.map((emp) => (
        <Card key={emp.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900/85">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {emp.profilePhotoUrl ? (
                  <img src={emp.profilePhotoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{emp.firstName} {emp.lastName}</p>
                <p className="text-xs text-muted-foreground">{emp.employeeNumber}</p>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground mb-3">
              <p>تاريخ الأرشفة: {emp.archivedAt ? new Date(emp.archivedAt).toLocaleDateString("ar-SA", { calendar: "gregory" }) : "غير مسجل"}</p>
              <p>تاريخ انتهاء الخدمة المسجل: {emp.terminationDate ? new Date(emp.terminationDate).toLocaleDateString("ar-SA", { calendar: "gregory" }) : "غير مسجل"}</p>
              <p>سبب الأرشفة: {emp.archiveReason || "غير مسجل"}</p>
              <p>هوية: {emp.nationalId}</p>
              {emp.departmentName && <p>إدارة: {emp.departmentName}</p>}
              {emp.positionTitle && <p>منصب: {emp.positionTitle}</p>}
              {emp.branchName && <p>فرع: {emp.branchName}</p>}
            </div>
            <Link href={`/employees/${encodeURIComponent(emp.id)}`} className="mb-2 flex items-center justify-center gap-2 rounded-md border p-2 text-sm font-medium"><Eye className="h-4 w-4" /> عرض الملف الكامل</Link>
            <Button size="sm" variant="outline" className="w-full gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-950" onClick={() => unarchive(emp.id)}>
              <UserCheck className="h-4 w-4" /> إلغاء الأرشفة
            </Button>
          </CardContent>
        </Card>
      ))}
    </div><div className="flex items-center justify-center gap-3"><Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button><span>{page} / {pageCount}</span><Button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>التالي</Button></div></div>
  );
}
