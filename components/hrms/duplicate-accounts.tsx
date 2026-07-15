"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Download, Copy, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Employee = {
  id: string;
  employeeNumber: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  hireDate: string;
  department: string;
  position: string;
  branch: string;
};

type DuplicateGroup = {
  type: "nationalId" | "email" | "employeeNumber" | "barcode";
  reason: string;
  value: string;
  count: number;
  employees: Employee[];
};

type ApiResponse = {
  success: boolean;
  duplicates: DuplicateGroup[];
  totalDuplicateEmployees: number;
  totalDuplicateGroups: number;
  uniqueDuplicateEmployees: number;
  byType: { nationalId: number; email: number; employeeNumber: number; barcode: number };
  totalEmployees: number;
};

export function DuplicateAccounts() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/employees/duplicates?${params.toString()}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const filtered = data?.duplicates || [];

  const exportToExcel = () => {
    if (!filtered.length) return;
    const headers = ["نوع التكرار", "السبب", "القيمة المكررة", "العدد", "ID", "الاسم", "الرقم الوظيفي", "الهوية", "البريد", "القسم", "الحالة"];
    const rows: string[][] = [headers];
    for (const group of filtered) {
      for (const emp of group.employees) {
        rows.push([
          group.type,
          group.reason,
          group.value,
          String(group.count),
          emp.id,
          emp.fullName,
          emp.employeeNumber,
          emp.nationalId,
          emp.email,
          emp.department,
          emp.status,
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `duplicate-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!filtered.length) return;
    const win = window.open("", "_blank");
    if (!win) return;
    let html = `
      <html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>الحسابات المكررة</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
        th { background: #1e293b; color: white; }
        .group { background: #fef3c7; font-weight: bold; }
      </style></head><body>
      <h1>تقرير الحسابات المكررة</h1>
      <p>إجمالي الموظفين: ${data?.totalEmployees} | مجموعات مكررة: ${data?.totalDuplicateGroups} | موظفون مكررون: ${data?.totalDuplicateEmployees} (فريد: ${data?.uniqueDuplicateEmployees})</p>
      <table><thead><tr><th>النوع</th><th>السبب</th><th>القيمة</th><th>العدد</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الهوية</th><th>البريد</th><th>القسم</th></tr></thead><tbody>
    `;
    for (const g of filtered) {
      for (let i = 0; i < g.employees.length; i++) {
        const emp = g.employees[i];
        html += `<tr>
          ${i === 0 ? `<td rowspan="${g.employees.length}" class="group">${g.type}</td><td rowspan="${g.employees.length}" class="group">${g.reason}</td><td rowspan="${g.employees.length}" class="group">${g.value}</td><td rowspan="${g.employees.length}" class="group">${g.count}</td>` : ""}
          <td>${emp.fullName}</td><td>${emp.employeeNumber}</td><td>${emp.nationalId}</td><td>${emp.email}</td><td>${emp.department}</td>
        </tr>`;
      }
    }
    html += `</tbody></table></body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const copyReport = async () => {
    if (!filtered.length) return;
    const text = filtered.map((g) => `${g.reason}: ${g.value} (${g.count})\n${g.employees.map((e) => ` - ${e.fullName} (${e.employeeNumber}, ${e.nationalId}, ${e.email})`).join("\n")}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    alert("تم نسخ التقرير");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader><CardTitle className="text-sm">إجمالي الموظفين</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.totalEmployees || 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">مجموعات مكررة</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{data?.totalDuplicateGroups || 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">موظفون مكررون</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{data?.totalDuplicateEmployees || 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">فريد مكرر</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.uniqueDuplicateEmployees || 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">هوية مكررة</CardTitle></CardHeader><CardContent><div className="text-sm">هوية: {data?.byType.nationalId || 0}<br/>بريد: {data?.byType.email || 0}<br/>رقم وظيفي: {data?.byType.employeeNumber || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />الحسابات المكررة</CardTitle>
          <div className="flex flex-wrap gap-2 mt-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <Input placeholder="بحث: اسم، رقم، هوية، بريد، قسم..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" size="sm"><Search className="h-4 w-4" /></Button>
            </form>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="all">الكل</option>
              <option value="nationalId">رقم هوية</option>
              <option value="email">بريد</option>
              <option value="employeeNumber">رقم وظيفي</option>
              <option value="barcode">باركود</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="count">عدد التكرار</option>
              <option value="value">القيمة</option>
            </select>
            <Button onClick={exportToExcel} variant="outline" size="sm"><Download className="h-4 w-4 ml-1" />Excel</Button>
            <Button onClick={exportToPDF} variant="outline" size="sm"><Download className="h-4 w-4 ml-1" />PDF</Button>
            <Button onClick={copyReport} variant="outline" size="sm"><Copy className="h-4 w-4 ml-1" />نسخ</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60"><tr>
                  <th className="px-3 py-2 text-right">النوع</th>
                  <th className="px-3 py-2 text-right">السبب</th>
                  <th className="px-3 py-2 text-right">القيمة المكررة</th>
                  <th className="px-3 py-2 text-right cursor-pointer" onClick={() => { setSortBy("count"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>العدد</th>
                  <th className="px-3 py-2 text-right">الموظفون</th>
                </tr></thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">لا يوجد تكرار</td></tr>
                  ) : (
                    filtered.map((group) => (
                      <tr key={`${group.type}-${group.value}`} className="hover:bg-muted/40">
                        <td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-1 text-xs">{group.type}</span></td>
                        <td className="px-3 py-2 font-medium text-red-600">{group.reason}</td>
                        <td className="px-3 py-2 font-mono font-bold">{group.value}</td>
                        <td className="px-3 py-2 text-center">{group.count}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            {group.employees.map((emp: any) => (
                              <div key={emp.id} className="flex items-center gap-2 rounded border p-2 bg-amber-50/50">
                                <span className="font-medium">{emp.fullName}</span>
                                <span className="text-xs text-muted-foreground">({emp.employeeNumber}, {emp.nationalId}, {emp.email || "لا بريد"})</span>
                                <span className="text-xs">{emp.department}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
