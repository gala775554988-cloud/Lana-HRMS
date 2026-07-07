"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BranchSelector({
  branches,
  departments,
  initialFilters = {}
}: {
  branches: Array<{ id: string; name: string; code: string; city?: string | null; country?: string | null; isActive?: boolean; employeeCount?: number; searchText?: string }>;
  departments: Array<{ id: string; name: string; code: string }>;
  initialFilters?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [department, setDepartment] = useState(initialFilters.department ?? "");
  const [hospital, setHospital] = useState(initialFilters.hospital ?? "");
  const [isActive, setIsActive] = useState(initialFilters.isActive ?? "");

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dep = department.trim().toLowerCase();
    const hosp = hospital.trim().toLowerCase();
    return branches.filter((branch) => {
      const text = `${branch.name} ${branch.code} ${branch.city ?? ""} ${branch.searchText ?? ""}`.toLowerCase();
      return (!q || text.includes(q)) && (!dep || text.includes(dep)) && (!hosp || text.includes(hosp)) && (!isActive || String(branch.isActive) === isActive);
    });
  }, [branches, department, hospital, isActive, search]);

  function reset() {
    setSearch("");
    setDepartment("");
    setHospital("");
    setIsActive("");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/30">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="البحث باسم الفرع أو الرمز أو الموظف" />
        <select value={department} onChange={(event) => setDepartment(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">الإدارة</option>
          {departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <Input value={hospital} onChange={(event) => setHospital(event.target.value)} placeholder="المستشفى" />
        <select value={isActive} onChange={(event) => setIsActive(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">الحالة</option>
          <option value="true">نشط</option>
          <option value="false">غير نشط</option>
        </select>
        <div className="flex gap-2 md:col-span-2 xl:col-span-4">
          <Button type="button" onClick={() => undefined}>تطبيق</Button>
          <Button type="button" variant="outline" onClick={reset}>إعادة تعيين</Button>
        </div>
      </div>

      <label className="grid max-w-md gap-2 text-sm">
        <span className="font-medium text-muted-foreground">اختر فرع</span>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) router.push(`/branches/${event.target.value}${search ? `?search=${encodeURIComponent(search)}` : ""}`);
          }}
        >
          <option value="">قائمة الفروع الموجودة</option>
          {filteredBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.code}) - {branch.employeeCount ?? 0} موظف
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
