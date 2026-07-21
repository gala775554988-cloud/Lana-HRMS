"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";

type ReportKind = "register" | "by-type" | "by-department" | "absentee" | "balances";

const REPORTS: Array<{ key: ReportKind; title: string; description: string }> = [
  { key: "register", title: "سجل طلبات الإجازات", description: "كل طلبات الإجازات مع الحالة والتواريخ والأيام." },
  { key: "by-type", title: "الإجازات حسب النوع", description: "عدد الطلبات وإجمالي الأيام لكل نوع إجازة." },
  { key: "by-department", title: "الإجازات حسب القسم", description: "توزيع الإجازات على الأقسام." },
  { key: "absentee", title: "كشف الغائبين اليوم", description: "الموظفون على إجازة معتمدة اليوم." },
  { key: "balances", title: "أرصدة الإجازات لكل موظف", description: "الرصيد المستحق والمستخدم والمتبقي لكل نوع إجازة." }
];

function ReportCard({ report }: { report: (typeof REPORTS)[number] }) {
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    setLoading(true);
    const res = await fetch(`/api/enterprise/leave/export?report=${report.key}&format=json`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setPreview(data?.success ? data.rows.slice(0, 5) : []);
    setLoading(false);
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.key]);

  const columns = preview && preview.length > 0 ? Object.keys(preview[0]) : [];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4.5 w-4.5 text-primary" />{report.title}</CardTitle>
        <CardDescription>{report.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : columns.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">لا توجد بيانات لعرضها حالياً</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>{columns.map((col) => <th key={col} className="p-2 text-right font-bold whitespace-nowrap">{col}</th>)}</tr>
              </thead>
              <tbody>
                {preview!.map((row, index) => (
                  <tr key={index} className="border-t">
                    {columns.map((col) => <td key={col} className="p-2 whitespace-nowrap">{String(row[col] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button asChild size="sm" variant="outline" className="gap-1.5 w-full">
          <a href={`/api/enterprise/leave/export?report=${report.key}&format=xlsx`}>
            <Download className="h-4 w-4" />تحميل Excel كامل
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function LeaveReports() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" dir="rtl">
      {REPORTS.map((report) => (
        <ReportCard key={report.key} report={report} />
      ))}
    </div>
  );
}
