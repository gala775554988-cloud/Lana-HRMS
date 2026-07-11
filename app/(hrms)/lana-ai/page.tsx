"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Activity, Shield, Database, FileSearch, AlertTriangle, CheckCircle, BarChart3, Zap } from "lucide-react";

type Report = {
  timestamp: string;
  durationMs: number;
  database: { employees: number; departments: number; branches: number; positions: number; inactive: number; duplicateNationalIds: number; duplicateEmails: number; missingIndexes: string[] };
  pages: { total: number; empty: string[]; emptyCount: number };
  apis: { total: number };
  performance: { slowQueries: string[]; hasIndexes: boolean; hasArchivedTab: boolean; hasDuplicateTab: boolean; hasLastActiveDate: boolean };
  security: { issues: string[]; hasAuth: boolean; hasRBAC: boolean };
  ux: { hasSearch: boolean; hasExcelExport: boolean; hasPDFExport: boolean; hasArchivedTab: boolean; hasDuplicatesTab: boolean; hasTabs: boolean };
  issues: { emptyPages: string[]; missingIndexes: string[]; securityIssues: string[]; slowQueries: string[]; duplicateNationalIds: number; duplicateEmails: number };
  improvements: string[];
  rating: { score: number; label: string };
};

export default function AISystemManagerPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-system-manager/analyze");
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setReport(json.report);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-primary">
          <Bot className="h-8 w-8" />
          AI System Manager
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          وحدة ذكية تقوم بتحليل المشروع بالكامل، اكتشاف الأخطاء، الصفحات الفارغة، النواقص، اقتراح تحسينات، مراقبة الأداء، تحليل قاعدة البيانات والأمن، وإعطاء تقييم للنظام.
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={fetchReport} disabled={loading}><Activity className="h-4 w-4 ml-2" />{loading ? "جاري التحليل..." : "تحليل النظام الآن"}</Button>
        <Button variant="outline" onClick={() => window.open("/api/ai-system-manager/analyze", "_blank")}>عرض JSON الخام</Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-red-700">خطأ: {error}</CardContent></Card>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />التقييم</CardTitle></CardHeader><CardContent><div className={`text-3xl font-black ${getScoreColor(report.rating.score)}`}>{report.rating.score}/100</div><div className="text-sm">{report.rating.label}</div><div className="text-xs text-muted-foreground mt-2">{report.durationMs}ms تحليل</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" />قاعدة البيانات</CardTitle></CardHeader><CardContent>
              <div className="text-sm">موظفون: {report.database.employees}</div>
              <div className="text-sm">إدارات: {report.database.departments}</div>
              <div className="text-sm">فروع: {report.database.branches}</div>
              <div className="text-sm">مؤرشفون: {report.database.inactive}</div>
              <div className="text-xs text-red-600 mt-1">هوية مكررة: {report.database.duplicateNationalIds} | بريد مكرر: {report.database.duplicateEmails}</div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileSearch className="h-4 w-4" />الصفحات</CardTitle></CardHeader><CardContent>
              <div className="text-sm">إجمالي: {report.pages.total}</div>
              <div className="text-sm">فارغة: {report.pages.emptyCount}</div>
              <div className="text-xs mt-1">{report.pages.empty.slice(0,3).join(", ")}</div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />الأمن</CardTitle></CardHeader><CardContent>
              <div className="text-sm">مشاكل: {report.security.issues.length}</div>
              <div className="text-xs">{report.security.hasAuth ? "✅ Auth" : "❌ Auth"} | {report.security.hasRBAC ? "✅ RBAC" : "❌ RBAC"}</div>
              <div className="text-xs mt-1 text-red-600">{report.security.issues.slice(0,2).join("; ")}</div>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" />الأداء</CardTitle></CardHeader><CardContent>
              <div className="space-y-2 text-sm">
                <div>Indexes: {report.performance.hasIndexes ? "✅ موجودة" : "❌ ناقصة: " + report.issues.missingIndexes.join(", ")}</div>
                <div>Archived Tab: {report.performance.hasArchivedTab ? "✅" : "❌"}</div>
                <div>Duplicates Tab: {report.performance.hasDuplicateTab ? "✅" : "❌"}</div>
                <div>LastActiveDate: {report.performance.hasLastActiveDate ? "✅" : "❌"}</div>
                {report.performance.slowQueries.map((q,i)=><div key={i} className="text-amber-600 text-xs">⚠️ {q}</div>)}
              </div>
            </CardContent></Card>

            <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-4 w-4" />تجربة المستخدم</CardTitle></CardHeader><CardContent>
              <div className="space-y-1 text-sm">
                <div>بحث: {report.ux.hasSearch ? "✅" : "❌"}</div>
                <div>Excel: {report.ux.hasExcelExport ? "✅" : "❌"}</div>
                <div>PDF: {report.ux.hasPDFExport ? "✅" : "❌"}</div>
                <div>تبويب مؤرشف: {report.ux.hasArchivedTab ? "✅" : "❌"}</div>
                <div>تبويب مكرر: {report.ux.hasDuplicatesTab ? "✅" : "❌"}</div>
              </div>
            </CardContent></Card>
          </div>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />المشاكل المكتشفة</CardTitle><CardDescription>يجب إصلاحها لتحسين التقييم</CardDescription></CardHeader><CardContent>
            <div className="space-y-3">
              {report.issues.emptyPages.length>0 && <div><strong>صفحات فارغة ({report.issues.emptyPages.length}):</strong> {report.issues.emptyPages.join(", ")}</div>}
              {report.issues.missingIndexes.length>0 && <div><strong>Indexes ناقصة:</strong> {report.issues.missingIndexes.join(", ")}</div>}
              {report.issues.securityIssues.length>0 && <div className="text-red-600"><strong>مشاكل أمنية:</strong> {report.issues.securityIssues.join("; ")}</div>}
              {report.issues.duplicateNationalIds>0 && <div><strong>هوية مكررة:</strong> {report.issues.duplicateNationalIds} رقم</div>}
              {report.issues.duplicateEmails>0 && <div><strong>بريد مكرر:</strong> {report.issues.duplicateEmails} بريد</div>}
            </div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>اقتراحات التحسين</CardTitle></CardHeader><CardContent>
            <ul className="list-disc pr-5 space-y-1 text-sm">
              {report.improvements.map((imp,i)=><li key={i}>{imp}</li>)}
            </ul>
          </CardContent></Card>

          <Card className="bg-slate-50 dark:bg-slate-900/50"><CardHeader><CardTitle>التقييم النهائي</CardTitle></CardHeader><CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-6xl font-black ${getScoreColor(report.rating.score)}`}>{report.rating.score}</div>
              <div>
                <div className="text-xl font-bold">{report.rating.label}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {report.rating.score >= 90 ? "نظام بمستوى عالمي، جاهز للبيع لآلاف الشركات" :
                   report.rating.score >= 80 ? "نظام جيد جداً، يحتاج تحسينات بسيطة ليصبح عالمياً" :
                   report.rating.score >= 70 ? "نظام جيد، يحتاج عمل متوسط" :
                   "نظام يحتاج تحسينات كبيرة"}
                </div>
              </div>
            </div>
          </CardContent></Card>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />تحليلات</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">تقارير الأداء والحضور والرواتب مع رسوم بيانية</p></CardContent></Card>
        <Card className="hover:border-primary/50 transition-colors"><CardHeader><CardTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5" />تدقيق</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">سجل التدقيق ومتابعة التغييرات</p></CardContent></Card>
        <Card className="hover:border-primary/50 transition-colors"><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />أمان</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">مراقبة الصلاحيات والجلسات</p></CardContent></Card>
      </div>
    </div>
  );
}
