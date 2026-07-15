"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCheck, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ArchivedEmployee {
  id: string; employeeNumber: string; nationalId: string;
  firstName: string; lastName: string; status: string;
  profilePhotoUrl?: string | null;
  departmentName: string; positionTitle: string; branchName: string;
  archiveReason?: string | null; archivedAt?: string | null;
}

export function ArchivedEmployees() {
  const [employees, setEmployees] = useState<ArchivedEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees/archived?pageSize=500");
      const json = await res.json();
      if (json.success) setEmployees(json.records || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unarchive = async (id: string) => {
    try {
      const res = await fetch("/api/employees/archive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, unarchive: true }),
      });
      const data = await res.json();
      if (data.success) setEmployees(prev => prev.filter(e => e.id !== id));
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

  if (!employees.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Archive className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-sm font-medium">لا يوجد موظفون مؤرشفي</p>
    </div>
  );

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <p>هوية: {emp.nationalId}</p>
              {emp.departmentName && <p>إدارة: {emp.departmentName}</p>}
              {emp.positionTitle && <p>منصب: {emp.positionTitle}</p>}
              {emp.branchName && <p>فرع: {emp.branchName}</p>}
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-950" onClick={() => unarchive(emp.id)}>
              <UserCheck className="h-4 w-4" /> إلغاء الأرشفة
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
