"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Download, Archive, Calendar, User, Building, Briefcase, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ArchivedEmployee = {
  id: string;
  employeeNumber: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  hireDate: string;
  terminationDate?: string | null;
  lastActiveDate?: string | null;
  lastActiveSource?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  departmentName: string;
  positionTitle: string;
  branchName: string;
  managerName: string;
  lastActiveDateFormatted?: string | null;
  archivedAtFormatted?: string | null;
  terminationDateFormatted?: string | null;
};

type ApiResponse = {
  success: boolean;
  records: ArchivedEmployee[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function ArchivedEmployees() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [sortBy, setSortBy] = useState("archivedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/employees/archived?${params.toString()}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const exportToExcel = () => {
    if (!data?.records.length) return;
    const headers = ["الاسم", "الرقم الوظيفي", "رقم الهوية", "القسم", "الوظيفة", "الفرع", "المدير", "البريد", "الجوال", "تاريخ التوظيف", "آخر يوم نشط", "تاريخ الأرشفة", "سبب الأرشفة", "الحالة"];
    const rows = data.records.map((emp) => [
      emp.fullName,
      emp.employeeNumber,
      emp.nationalId,
      emp.departmentName,
      emp.positionTitle,
      emp.branchName,
      emp.managerName,
      emp.email || "",
      emp.phone || "",
      emp.hireDate?.slice(0, 10) || "",
      emp.lastActiveDateFormatted || "",
      emp.archivedAtFormatted || "",
      emp.archiveReason || "",
      emp.status,
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archived-employees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !data) return;
    let html = `
      <html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>الموظفون المؤرشفون</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
        th { background: #1e293b; color: white; }
        tr:nth-child(even) { background: #f9fafb; }
      </style></head><body>
      <h1>الموظفون المؤرشفون / غير النشطين</h1>
      <p>إجمالي: ${data.total} - تاريخ: ${new Date().toLocaleString("ar-SA")}</p>
      <table><thead><tr>
        <th>الاسم</th><th>الرقم الوظيفي</th><th>الهوية</th><th>القسم</th><th>الوظيفة</th><th>الفرع</th><th>المدير</th><th>البريد</th><th>الجوال</th><th>التوظيف</th><th>آخر نشاط</th><th>الأرشفة</th><th>السبب</th><th>الحالة</th>
      </tr></thead><tbody>
    `;
    for (const emp of data.records) {
      html += `<tr>
        <td>${emp.fullName}</td><td>${emp.employeeNumber}</td><td>${emp.nationalId}</td>
        <td>${emp.departmentName}</td><td>${emp.positionTitle}</td><td>${emp.branchName}</td>
        <td>${emp.managerName}</td><td>${emp.email || ""}</td><td>${emp.phone || ""}</td>
        <td>${emp.hireDate?.slice(0, 10) || ""}</td><td>${emp.lastActiveDateFormatted || ""}</td>
        <td>${emp.archivedAtFormatted || ""}</td><td>${emp.archiveReason || ""}</td><td>${emp.status}</td>
      </tr>`;
    }
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />الموظفون المؤرشفون / غير النشطين</CardTitle>
          <div className="text-sm text-muted-foreground">إجمالي {data?.total || 0} موظف مؤرشف - لا يتم حذف الموظف من قاعدة البيانات، يبقى مؤرشفاً فقط</div>
          <div className="flex flex-wrap gap-2 mt-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <Input placeholder="بحث: اسم، رقم وظيفي، هوية، قسم..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit" size="sm"><Search className="h-4 w-4" /></Button>
            </form>
            <Button onClick={exportToExcel} variant="outline" size="sm"><Download className="h-4 w-4 ml-1" />Excel</Button>
            <Button onClick={exportToPDF} variant="outline" size="sm"><Download className="h-4 w-4 ml-1" />PDF</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center">جاري التحميل...</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60"><tr>
                    <th className="px-3 py-2 text-right cursor-pointer" onClick={() => { setSortBy("firstName"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>الاسم</th>
                    <th className="px-3 py-2 text-right">الرقم الوظيفي</th>
                    <th className="px-3 py-2 text-right">رقم الهوية</th>
                    <th className="px-3 py-2 text-right">القسم</th>
                    <th className="px-3 py-2 text-right">الوظيفة</th>
                    <th className="px-3 py-2 text-right">الفرع</th>
                    <th className="px-3 py-2 text-right">المدير</th>
                    <th className="px-3 py-2 text-right">البريد</th>
                    <th className="px-3 py-2 text-right">الجوال</th>
                    <th className="px-3 py-2 text-right cursor-pointer" onClick={() => { setSortBy("hireDate"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>التوظيف</th>
                    <th className="px-3 py-2 text-right cursor-pointer" onClick={() => { setSortBy("lastActiveDate"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>آخر نشاط</th>
                    <th className="px-3 py-2 text-right">تاريخ الأرشفة</th>
                    <th className="px-3 py-2 text-right">سبب الأرشفة</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {data?.records.length === 0 ? (
                      <tr><td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">لا يوجد موظفون مؤرشفون</td></tr>
                    ) : (
                      data?.records.map((emp) => (
                        <tr key={emp.id} className="hover:bg-muted/40">
                          <td className="px-3 py-2 font-medium">{emp.fullName}</td>
                          <td className="px-3 py-2 font-mono">{emp.employeeNumber}</td>
                          <td className="px-3 py-2 font-mono">{emp.nationalId}</td>
                          <td className="px-3 py-2">{emp.departmentName}</td>
                          <td className="px-3 py-2">{emp.positionTitle}</td>
                          <td className="px-3 py-2">{emp.branchName}</td>
                          <td className="px-3 py-2">{emp.managerName}</td>
                          <td className="px-3 py-2">{emp.email}</td>
                          <td className="px-3 py-2">{emp.phone}</td>
                          <td className="px-3 py-2">{emp.hireDate?.slice(0, 10)}</td>
                          <td className="px-3 py-2"><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{emp.lastActiveDateFormatted || "-"}</span><span className="text-xs text-muted-foreground">{emp.lastActiveSource || ""}</span></td>
                          <td className="px-3 py-2">{emp.archivedAtFormatted || emp.terminationDateFormatted || "-"}</td>
                          <td className="px-3 py-2">{emp.archiveReason || "-"}</td>
                          <td className="px-3 py-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{emp.status}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm">
                <span>صفحة {data?.page} من {data?.pageCount} - {data?.total} سجل</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>السابق</Button>
                  <Button variant="outline" size="sm" disabled={data ? page >= data.pageCount : false} onClick={() => setPage((p) => p + 1)}>التالي</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
