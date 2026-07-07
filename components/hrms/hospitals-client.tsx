"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Ref[]>([]);
  const [branches, setBranches] = useState<Ref[]>([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [editing, setEditing] = useState<Hospital | null>(null);
  const [form, setForm] = useState({ name: "", code: "", departmentId: "", branchId: "", isActive: true });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

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
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "فشل تحميل المستشفيات");
        setHospitals(data.hospitals ?? []);
        setDepartments(data.departments ?? []);
        setBranches(data.branches ?? []);
      })
      .catch((error) => setMessage(error.message));
  };

  useEffect(load, [query]);

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
      const data = await response.json();
      if (!data.success) {
        setMessage(data.message || "فشل الحفظ");
        return;
      }
      setMessage("تم حفظ المستشفى بنجاح");
      startEdit();
      load();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/30">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="البحث" />
          <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الإدارة</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الفرع</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <select value={isActive} onChange={(event) => setIsActive(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الحالة</option>
            <option value="true">نشط</option>
            <option value="false">غير نشط</option>
          </select>
          <Button type="button" onClick={() => startEdit()}>إضافة مستشفى</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/30">
        <h2 className="mb-4 text-lg font-semibold">{editing ? "تعديل مستشفى" : "إضافة مستشفى"}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="اسم المستشفى" />
          <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="الرمز" />
          <select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الإدارة</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الفرع</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />نشط</label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" disabled={isPending || !form.name.trim()} onClick={save}>حفظ</Button>
          <Button type="button" variant="outline" onClick={() => startEdit()}>إلغاء</Button>
        </div>
      </div>

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/30">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">المستشفى</th><th className="px-4 py-3 text-start">الإدارة</th><th className="px-4 py-3 text-start">الفرع</th><th className="px-4 py-3 text-start">عدد الموظفين</th><th className="px-4 py-3 text-start">الحالة</th><th className="px-4 py-3 text-start">الإجراءات</th></tr>
          </thead>
          <tbody>
            {hospitals.map((hospital) => (
              <tr key={hospital.id} className="border-t border-slate-100 transition-colors hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/20">
                <td className="px-4 py-3">{hospital.name}<div className="text-xs text-muted-foreground">{hospital.code}</div></td>
                <td className="px-4 py-3">{hospital.department?.name ?? "-"}</td>
                <td className="px-4 py-3">{hospital.branch?.name ?? "-"}</td>
                <td className="px-4 py-3">{hospital.employeeCount}</td>
                <td className="px-4 py-3">{hospital.isActive ? "نشط" : "غير نشط"}</td>
                <td className="px-4 py-3"><div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link href={`/hospitals/${hospital.id}`}>عرض</Link></Button><Button size="sm" variant="outline" onClick={() => startEdit(hospital)}>تعديل</Button></div></td>
              </tr>
            ))}
            {hospitals.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">لا توجد مستشفيات</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
