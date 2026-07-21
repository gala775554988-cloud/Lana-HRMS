"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, MapPin, Briefcase, Plus, Search, LayoutGrid, Table as TableIcon, ExternalLink, Edit, RefreshCw } from "lucide-react";

type Hospital = {
  id: string;
  name: string;
  code?: string;
  departmentId?: string | null;
  branchId?: string | null;
  isActive: boolean;
  employeeCount: number;
  department?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
};

type Ref = { id: string; name: string; code: string };

export function HospitalsClient() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Ref[]>([]);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [editing, setEditing] = useState<Hospital | null>(null);
  const [form, setForm] = useState({ name: "", code: "", departmentId: "", branchId: "", isActive: true });
  const [message, setMessage] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMessage(null);
    try {
      const res = await fetch("/api/enterprise/hospitals/reconcile", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setReconcileMessage(data.message);
        load();
        router.refresh();
      } else {
        setReconcileMessage(`خطأ: ${data.message}`);
      }
    } catch (err: any) {
      setReconcileMessage(`خطأ في المزامنة: ${err.message || String(err)}`);
    } finally {
      setReconciling(false);
    }
  };

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (departmentId) params.set("departmentId", departmentId);
    if (branchId) params.set("branchId", branchId);
    if (isActive) params.set("isActive", isActive);
    return params.toString();
  }, [branchId, departmentId, isActive, search]);

  const load = () => {
    fetch(`/api/enterprise/hospitals?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({ success: false, message: "فشل قراءة رد المستشفيات" }));
        if (!response.ok || !data.success) throw new Error(data.message || "فشل تحميل المستشفيات");
        return data;
      })
      .then((data) => {
        setHospitals(data.hospitals ?? []);
        setDepartments(data.departments ?? []);
        setBranches(data.branches ?? []);
      })
      .catch((error) => setMessage(error.message));
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(load, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  function startEdit(hospital?: Hospital) {
    setEditing(hospital ?? null);
    setForm({
      name: hospital?.name ?? "",
      code: hospital?.code ?? "",
      departmentId: hospital?.departmentId ?? "",
      branchId: hospital?.branchId ?? "",
      isActive: hospital?.isActive ?? true
    });
  }

  function save() {
    startTransition(async () => {
      const response = await fetch("/api/enterprise/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing?.id, ...form })
      });
      const data = await response.json().catch(() => ({ success: false, message: "فشل قراءة رد الحفظ" }));
      if (!response.ok || !data.success) {
        setMessage(data.message || "فشل الحفظ");
        return;
      }
      setMessage("تم حفظ المستشفى بنجاح");
      startEdit();
      load();
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Search and Filters Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مستشفى أو موقع طبي بالاسم أو الرمز..."
              className="pr-10 h-10 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
              <option value="">كل الإدارات</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
              <option value="">كل الفروع</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <div className="flex rounded-xl border overflow-hidden bg-muted/30 p-0.5">
              <Button
                variant={viewMode === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="rounded-lg gap-1.5 h-8 px-3"
              >
                <LayoutGrid className="h-4 w-4" />
                بطاقات
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="rounded-lg gap-1.5 h-8 px-3"
              >
                <TableIcon className="h-4 w-4" />
                جدول
              </Button>
            </div>
            <Button
              type="button"
              onClick={handleReconcile}
              disabled={reconciling}
              className="rounded-xl gap-1.5 h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-sm"
              title="مزامنة وربط كافة الموظفين بالمستشفيات وفروعهم بدقة عالية 100%"
            >
              <RefreshCw className={`h-4 w-4 ${reconciling ? "animate-spin" : ""}`} />
              <span>{reconciling ? "جاري المزامنة والربط..." : "⚡ مزامنة وربط الموظفين (100%)"}</span>
            </Button>
            <Button type="button" onClick={() => startEdit()} className="rounded-xl gap-1.5 h-10">
              <Plus className="h-4 w-4" />
              إضافة مستشفى
            </Button>
          </div>
        </div>
      </div>

      {reconcileMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/95 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 text-sm font-bold flex items-center justify-between shadow-2xs">
          <span>{reconcileMessage}</span>
          <button onClick={() => setReconcileMessage(null)} className="text-xs underline hover:opacity-80">إغلاق</button>
        </div>
      )}

      {editing || form.name ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-semibold">{editing ? "تعديل مستشفى" : "إضافة مستشفى جديد"}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="اسم المستشفى" className="rounded-xl" />
            <Input value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))} placeholder="الرمز" className="rounded-xl" />
            <select value={form.departmentId} onChange={(e) => setForm((current) => ({ ...current, departmentId: e.target.value }))} className="h-10 rounded-xl border bg-background px-3 text-sm">
              <option value="">الإدارة</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select value={form.branchId} onChange={(e) => setForm((current) => ({ ...current, branchId: e.target.value }))} className="h-10 rounded-xl border bg-background px-3 text-sm">
              <option value="">الفرع</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-xl border px-3 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} className="h-4 w-4 rounded text-primary focus:ring-primary" />
              نشط
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={isPending || !form.name.trim()} onClick={save} className="rounded-xl px-6">حفظ</Button>
            <Button type="button" variant="outline" onClick={() => startEdit()} className="rounded-xl px-6">إلغاء</Button>
          </div>
        </div>
      ) : null}

      {message ? <div className="rounded-xl border bg-primary/50 p-3 text-sm text-primary dark:bg-primary/20 dark:text-primary/20">{message}</div> : null}

      {viewMode === "card" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hospitals.map((hospital) => (
            <Card
              key={hospital.id}
              onClick={() => router.push(`/hospitals/${hospital.id}`)}
              className="rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary cursor-pointer overflow-hidden flex flex-col justify-between"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary/8 dark:bg-primary/50 flex items-center justify-center text-primary dark:text-primary/50 shrink-0">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {hospital.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                        {hospital.code}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Badge variant="secondary" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 font-bold px-3 py-1 rounded-xl text-xs">
                    <Users className="h-3.5 w-3.5" />
                    {hospital.employeeCount} موظف نشط
                  </Badge>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${hospital.isActive ? "bg-primary/8 text-primary dark:bg-primary/40 dark:text-primary/30" : "bg-slate-100 text-slate-500"}`}>
                    {hospital.isActive ? "نشط" : "غير نشط"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{hospital.department?.name || "الإدارة غير محددة"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{hospital.branch?.name || "الفرع غير محدد"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs h-8 px-3" onClick={() => startEdit(hospital)}>
                    <Edit className="h-3.5 w-3.5 me-1" />
                    تعديل
                  </Button>
                  <Button size="sm" className="rounded-xl text-xs h-8 px-3 gap-1 bg-primary hover:bg-primary text-white" onClick={() => router.push(`/hospitals/${hospital.id}`)}>
                    <span>عرض الموظفين</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {hospitals.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-muted-foreground dark:border-slate-700">
              <Building2 className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <p className="font-semibold text-base">لا توجد مستشفيات أو مواقع طبية متطابقة مع البحث</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">المستشفى</th>
                <th className="px-4 py-3 text-start">الإدارة</th>
                <th className="px-4 py-3 text-start">الفرع</th>
                <th className="px-4 py-3 text-start">عدد الموظفين النشطين</th>
                <th className="px-4 py-3 text-start">الحالة</th>
                <th className="px-4 py-3 text-start">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((hospital) => (
                <tr key={hospital.id} className="border-t border-slate-100 transition-colors hover:bg-primary/40 dark:border-slate-800 dark:hover:bg-primary/20">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 cursor-pointer" onClick={() => router.push(`/hospitals/${hospital.id}`)}>
                    {hospital.name}
                    <div className="text-xs font-mono font-normal text-muted-foreground">{hospital.code}</div>
                  </td>
                  <td className="px-4 py-3">{hospital.department?.name ?? "-"}</td>
                  <td className="px-4 py-3">{hospital.branch?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                      <Users className="h-3 w-3" />
                      {hospital.employeeCount}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{hospital.isActive ? "نشط" : "غير نشط"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => router.push(`/hospitals/${hospital.id}`)}>عرض الموظفين</Button>
                      <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => startEdit(hospital)}>تعديل</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {hospitals.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">لا توجد مستشفيات</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
