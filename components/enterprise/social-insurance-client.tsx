"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Landmark, Users, UserCheck, UserX, ShieldCheck, ShieldOff, ShieldAlert,
  Wallet, TrendingUp, Search, X, Check, FileSpreadsheet, Printer, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Stats = {
  totalEmployees: number;
  registered: number;
  notRegistered: number;
  activeSubscribers: number;
  suspended: number;
  excluded: number;
  salaryChangesThisMonth: number;
  totalSubjectWages: number;
  employeeContributionTotal: number;
  employerContributionTotal: number;
};

type EmployeeLite = {
  id: string;
  employeeNumber: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  department: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  nationality: { id: string; name: string } | null;
};

type Movement = {
  id: string;
  type: string;
  description: string;
  source: string;
  createdAt: string;
};

type RecordRow = {
  id: string;
  status: "NOT_REGISTERED" | "ACTIVE" | "SUSPENDED" | "EXCLUDED";
  subscriberNumber: string | null;
  registrationDate: string | null;
  subjectWage: number | string;
  employeeContributionAmount: number | string;
  employerContributionAmount: number | string;
} | null;

type ListRow = { employee: EmployeeLite; record: RecordRow };

const STATUS_LABELS: Record<string, string> = {
  NOT_REGISTERED: "غير مسجل",
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  EXCLUDED: "مستبعد"
};
const STATUS_COLORS: Record<string, string> = {
  NOT_REGISTERED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  SUSPENDED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  EXCLUDED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
};

const REPORTS = [
  { key: "registered", label: "المسجلون" },
  { key: "unregistered", label: "غير المسجلين" },
  { key: "excluded", label: "المستبعدون" },
  { key: "new", label: "التسجيلات الجديدة" },
  { key: "salary-adjustments", label: "تعديلات الأجر" }
] as const;

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: string | number; icon: any; tone: string }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white/90 shadow-sm dark:bg-slate-900/80">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
          </div>
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtNumber(value: number | string) {
  return new Intl.NumberFormat("ar-SA").format(Number(value) || 0);
}

function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/enterprise/social-insurance/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.stats); else setError(d.message || "تعذر تحميل الإحصائيات"); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">جاري التحميل...</div>;
  if (error || !stats) return <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{error || "لا توجد بيانات"}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="إجمالي الموظفين" value={fmtNumber(stats.totalEmployees)} icon={Users} tone="bg-slate-100 text-slate-700" />
      <StatCard title="المسجلون" value={fmtNumber(stats.registered)} icon={UserCheck} tone="bg-blue-50 text-blue-700" />
      <StatCard title="غير المسجلين" value={fmtNumber(stats.notRegistered)} icon={UserX} tone="bg-rose-50 text-rose-700" />
      <StatCard title="المشتركون النشطون" value={fmtNumber(stats.activeSubscribers)} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
      <StatCard title="الموقوفون" value={fmtNumber(stats.suspended)} icon={ShieldAlert} tone="bg-amber-50 text-amber-700" />
      <StatCard title="المستبعدون" value={fmtNumber(stats.excluded)} icon={ShieldOff} tone="bg-slate-100 text-slate-700" />
      <StatCard title="تغييرات الرواتب هذا الشهر" value={fmtNumber(stats.salaryChangesThisMonth)} icon={TrendingUp} tone="bg-violet-50 text-violet-700" />
      <StatCard title="إجمالي الأجور الخاضعة" value={fmtNumber(stats.totalSubjectWages)} icon={Wallet} tone="bg-primary/10 text-primary" />
      <StatCard title="مساهمة الموظفين" value={fmtNumber(stats.employeeContributionTotal)} icon={Wallet} tone="bg-sky-50 text-sky-700" />
      <StatCard title="مساهمة الجهة" value={fmtNumber(stats.employerContributionTotal)} icon={Landmark} tone="bg-indigo-50 text-indigo-700" />
    </div>
  );
}

export function SocialInsuranceEditDialog({
  employeeId,
  employeeLabel,
  record,
  onClose,
  onSaved
}: {
  employeeId: string;
  employeeLabel: string;
  record: RecordRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(record?.status ?? "ACTIVE");
  const [subscriberNumber, setSubscriberNumber] = useState(record?.subscriberNumber ?? "");
  const [registrationDate, setRegistrationDate] = useState(record?.registrationDate ? record.registrationDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [subjectWage, setSubjectWage] = useState(record ? String(record.subjectWage) : "");
  const [exclusionReason, setExclusionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);

  useEffect(() => {
    fetch(`/api/enterprise/social-insurance/${employeeId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setMovements(d.record?.movements ?? []); })
      .finally(() => setLoadingMovements(false));
  }, [employeeId]);

  async function save() {
    if (status === "EXCLUDED" && record?.status !== "EXCLUDED" && !exclusionReason.trim()) {
      setMessage("سبب الاستبعاد مطلوب");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/enterprise/social-insurance/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          subscriberNumber: subscriberNumber || null,
          registrationDate: registrationDate || null,
          subjectWage: subjectWage ? Number(subjectWage) : 0,
          ...(status === "EXCLUDED" ? { exclusionReason, exclusionDate: new Date().toISOString().slice(0, 10) } : {})
        })
      });
      const data = await response.json();
      if (!data.success) { setMessage(data.message || "فشل الحفظ"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{employeeLabel} — التأمينات الاجتماعية</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {message ? <div className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20">{message}</div> : null}
        <div className="space-y-3">
          <label className="space-y-1.5 text-sm block">
            <span className="font-bold">الحالة</span>
            <select className="h-10 w-full rounded-lg border bg-background px-3" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="NOT_REGISTERED">غير مسجل</option>
              <option value="ACTIVE">نشط</option>
              <option value="SUSPENDED">موقوف</option>
              <option value="EXCLUDED">مستبعد</option>
            </select>
          </label>
          <Input placeholder="رقم المشترك" value={subscriberNumber} onChange={(e) => setSubscriberNumber(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-bold">تاريخ التسجيل</span>
              <Input type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-bold">الأجر الخاضع للاشتراك</span>
              <Input type="number" min="0" step="0.01" value={subjectWage} onChange={(e) => setSubjectWage(e.target.value)} />
            </label>
          </div>
          {status === "EXCLUDED" ? (
            <Input placeholder="سبب الاستبعاد" value={exclusionReason} onChange={(e) => setExclusionReason(e.target.value)} />
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> سجل الحركات</p>
          {loadingMovements ? (
            <p className="text-xs text-muted-foreground">جاري التحميل...</p>
          ) : movements.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد حركات مسجلة بعد.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {movements.map((m) => (
                <div key={m.id} className="rounded-xl border p-2.5 text-xs">
                  <p className="font-medium">{m.description}</p>
                  <p className="mt-1 text-muted-foreground">{new Date(m.createdAt).toLocaleString("ar-SA")} · {m.source === "PAYROLL_SYNC" ? "مزامنة تلقائية" : m.source === "MANUAL" ? "يدوي" : m.source}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListTab() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ListRow | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(page));
    fetch(`/api/enterprise/social-insurance?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) { setRows(d.records); setTotal(d.total); } })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, page]);

  const pageCount = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الرقم الوظيفي أو الهوية"
            className="pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }}
          />
        </div>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">كل الحالات</option>
          <option value="NOT_REGISTERED">غير مسجل</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">موقوف</option>
          <option value="EXCLUDED">مستبعد</option>
        </select>
        <Button type="button" variant="outline" onClick={() => { setPage(1); load(); }}>بحث</Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">جاري التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">لا توجد نتائج مطابقة.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-bold text-muted-foreground">
              <tr>
                <th className="p-3 text-right">الموظف</th>
                <th className="p-3 text-right">الإدارة / الفرع</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">رقم المشترك</th>
                <th className="p-3 text-right">الأجر الخاضع</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee.id} className="border-t">
                  <td className="p-3">
                    <p className="font-bold">{row.employee.firstName} {row.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{row.employee.employeeNumber}</p>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{row.employee.department?.name ?? "—"} / {row.employee.branch?.name ?? "—"}</td>
                  <td className="p-3"><Badge className={STATUS_COLORS[row.record?.status ?? "NOT_REGISTERED"]}>{STATUS_LABELS[row.record?.status ?? "NOT_REGISTERED"]}</Badge></td>
                  <td className="p-3">{row.record?.subscriberNumber ?? "—"}</td>
                  <td className="p-3">{row.record ? fmtNumber(row.record.subjectWage) : "—"}</td>
                  <td className="p-3 text-left">
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(row)}>{row.record ? "تعديل" : "تسجيل"}</Button>
                      <Link href={`/employees/${row.employee.id}`} className="text-xs text-primary hover:underline">الملف الكامل</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
          <span className="text-sm text-muted-foreground">صفحة {page} من {pageCount}</span>
          <Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      ) : null}

      {editing ? (
        <SocialInsuranceEditDialog
          employeeId={editing.employee.id}
          employeeLabel={`${editing.employee.firstName} ${editing.employee.lastName}`}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : null}
    </div>
  );
}

function ReportsTab() {
  const [report, setReport] = useState<(typeof REPORTS)[number]["key"]>("registered");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [nationalityId, setNationalityId] = useState("");
  const [orgOptions, setOrgOptions] = useState<{ branches: any[]; departments: any[]; nationalities: any[] }>({ branches: [], departments: [], nationalities: [] });

  useEffect(() => {
    fetch("/api/enterprise/social-insurance/org-options", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setOrgOptions({ branches: d.branches ?? [], departments: d.departments ?? [], nationalities: d.nationalities ?? [] }); })
      .catch(() => null);
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("report", report);
    if (branchId) params.set("branchId", branchId);
    if (departmentId) params.set("departmentId", departmentId);
    if (nationalityId) params.set("nationalityId", nationalityId);
    return params.toString();
  }, [report, branchId, departmentId, nationalityId]);

  return (
    <div className="space-y-5" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />تقارير التأمينات الاجتماعية</CardTitle>
          <CardDescription>اختر نوع التقرير والفلاتر، ثم صدّر إلى Excel أو اطبع/احفظ كـ PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={report} onChange={(e) => setReport(e.target.value as any)}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">كل الفروع</option>
              {orgOptions.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">كل الإدارات</option>
              {orgOptions.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={nationalityId} onChange={(e) => setNationalityId(e.target.value)}>
              <option value="">كل الجنسيات</option>
              {orgOptions.nationalities.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/enterprise/social-insurance/export?${query}&format=xlsx`}>
              <Button type="button"><FileSpreadsheet className="me-2 h-4 w-4" />تصدير Excel</Button>
            </a>
            <a href={`/print-reports/social-insurance?${query}`} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline"><Printer className="me-2 h-4 w-4" />طباعة / حفظ PDF</Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SocialInsuranceClient() {
  const [tab, setTab] = useState<"dashboard" | "list" | "reports">("dashboard");

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex gap-1.5 rounded-2xl border bg-card p-1.5 w-fit">
        <button type="button" onClick={() => setTab("dashboard")} className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === "dashboard" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>لوحة التحكم</button>
        <button type="button" onClick={() => setTab("list")} className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>القائمة</button>
        <button type="button" onClick={() => setTab("reports")} className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === "reports" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>التقارير</button>
      </div>

      {tab === "dashboard" ? <DashboardTab /> : tab === "list" ? <ListTab /> : <ReportsTab />}
    </div>
  );
}
