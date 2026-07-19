"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Employee = {
  odooId: number;
  name: string;
  employeeNumber: string;
  barcode: string;
  email: string;
  department: string;
  departmentId?: number | null;
  job?: string;
  active: boolean;
  write_date?: string | null;
};

type DuplicateGroup = {
  nationalId: string;
  count: number;
  employees: Employee[];
};

type ApiResponse = {
  success: boolean;
  duplicates: DuplicateGroup[];
  totalDuplicateEmployees: number;
  totalDuplicateNationalIds: number;
  totalEmployees: number;
  fetchedAt?: string;
  message?: string;
};

export default function DuplicateReportClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/odoo/duplicate-national-ids");
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "فشل في جلب البيانات");
      setData(json);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.duplicates;
    const q = search.toLowerCase();
    return data.duplicates.filter((g) => {
      if (g.nationalId.toLowerCase().includes(q)) return true;
      return g.employees.some((emp) => 
        emp.name.toLowerCase().includes(q) ||
        emp.employeeNumber.toLowerCase().includes(q) ||
        emp.barcode.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        String(emp.odooId).includes(q)
      );
    });
  }, [data, search]);

  const exportToExcel = () => {
    if (!filtered.length) return;
    // Generate CSV that Excel can open
    const headers = ["nationalId", "count", "odooId", "name", "employeeNumber", "barcode", "email", "department", "active"];
    const rows: string[] = [];
    rows.push(headers.join(","));
    for (const group of filtered) {
      for (const emp of group.employees) {
        const row = [
          `"${group.nationalId.replace(/"/g, '""')}"`,
          group.count,
          emp.odooId,
          `"${emp.name.replace(/"/g, '""')}"`,
          `"${emp.employeeNumber.replace(/"/g, '""')}"`,
          `"${emp.barcode.replace(/"/g, '""')}"`,
          `"${emp.email.replace(/"/g, '""')}"`,
          `"${emp.department.replace(/"/g, '""')}"`,
          emp.active ? "true" : "false",
        ];
        rows.push(row.join(","));
      }
    }
    const csv = rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `duplicate-national-ids-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!filtered.length) return;
    // Create printable window for PDF
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    let html = `
      <html dir="rtl" lang="ar">
      <head><meta charset="utf-8"><title>تقرير أرقام الهوية المكررة</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; }
        .summary { margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
        th { background: #1e293b; color: white; }
        tr:nth-child(even) { background: #f9fafb; }
        .group-header { background: #fef3c7 !important; font-weight: bold; }
      </style>
      </head><body>
      <h1>تقرير أرقام الهوية المكررة - Odoo</h1>
      <div class="summary">
        <p>إجمالي موظفي Odoo: ${data?.totalEmployees || 0}</p>
        <p>عدد أرقام الهوية المكررة: ${data?.totalDuplicateNationalIds || 0}</p>
        <p>عدد الموظفين المكررين: ${data?.totalDuplicateEmployees || 0}</p>
        <p>تاريخ التقرير: ${new Date().toLocaleString("ar-SA")}</p>
      </div>
      <table><thead><tr>
        <th>رقم الهوية</th><th>العدد</th><th>Odoo ID</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الباركود</th><th>البريد</th><th>القسم</th><th>نشط</th>
      </tr></thead><tbody>
    `;
    for (const group of filtered) {
      for (let i = 0; i < group.employees.length; i++) {
        const emp = group.employees[i];
        html += `<tr>
          ${i === 0 ? `<td rowspan="${group.employees.length}" class="group-header">${group.nationalId}<br>(${group.count})</td><td rowspan="${group.employees.length}" class="group-header">${group.count}</td>` : ""}
          <td>${emp.odooId}</td>
          <td>${emp.name}</td>
          <td>${emp.employeeNumber}</td>
          <td>${emp.barcode}</td>
          <td>${emp.email}</td>
          <td>${emp.department}</td>
          <td>${emp.active ? "نعم" : "لا"}</td>
        </tr>`;
      }
    }
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  if (loading) return <div className="p-8 text-center">جاري فحص جميع موظفي Odoo (active_test=false)... قد يستغرق دقيقة</div>;
  if (error) return (
    <Card><CardContent className="p-6">
      <div className="text-red-600">خطأ: {error}</div>
      <Button onClick={fetchReport} className="mt-4">إعادة المحاولة</Button>
    </CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">إجمالي Odoo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.totalEmployees ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">أرقام مكررة</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{data?.totalDuplicateNationalIds ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">موظفون مكررون</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{data?.totalDuplicateEmployees ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">مجموعات معروضة</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تقرير أرقام الهوية المكررة</CardTitle>
          <div className="flex flex-wrap gap-2 mt-4">
            <Input placeholder="بحث: رقم هوية، اسم، رقم وظيفي، بريد، قسم، Odoo ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
            <Button onClick={exportToExcel} variant="outline">تصدير Excel (CSV)</Button>
            <Button onClick={exportToPDF} variant="outline">تصدير PDF / طباعة</Button>
            <Button onClick={fetchReport} variant="outline">تحديث</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60"><tr>
                <th className="px-3 py-2 text-right">رقم الهوية</th>
                <th className="px-3 py-2 text-right">العدد</th>
                <th className="px-3 py-2 text-right">Odoo ID</th>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">الرقم الوظيفي</th>
                <th className="px-3 py-2 text-right">الباركود</th>
                <th className="px-3 py-2 text-right">البريد</th>
                <th className="px-3 py-2 text-right">القسم</th>
                <th className="px-3 py-2 text-right">نشط</th>
              </tr></thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">لا يوجد تكرار - أو لا يوجد نتائج بحث</td></tr>
                ) : (
                  filtered.flatMap((group) =>
                    group.employees.map((emp, idx) => (
                      <tr key={`${group.nationalId}-${emp.odooId}`} className={idx === 0 ? "bg-amber-50/50" : ""}>
                        {idx === 0 && (
                          <>
                            <td rowSpan={group.employees.length} className="px-3 py-2 font-mono font-bold bg-amber-100/50">{group.nationalId}</td>
                            <td rowSpan={group.employees.length} className="px-3 py-2 text-center bg-amber-100/50">{group.count}</td>
                          </>
                        )}
                        <td className="px-3 py-2">{emp.odooId}</td>
                        <td className="px-3 py-2">{emp.name}</td>
                        <td className="px-3 py-2 font-mono">{emp.employeeNumber}</td>
                        <td className="px-3 py-2 font-mono">{emp.barcode}</td>
                        <td className="px-3 py-2">{emp.email}</td>
                        <td className="px-3 py-2">{emp.department}</td>
                        <td className="px-3 py-2">{emp.active ? "نعم" : "لا"}</td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            * التقرير لا يحذف ولا يعدل أي بيانات - فقط عرض. إجمالي {data?.totalDuplicateEmployees} موظف مكرر في {data?.totalDuplicateNationalIds} رقم هوية مكرر من أصل {data?.totalEmployees} موظف في Odoo.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
