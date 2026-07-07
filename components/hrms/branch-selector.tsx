"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BranchSelector({
  branches,
  departments,
  initialFilters = {}
}: {
  branches: Array<{ id: string; name: string; code: string; city?: string | null; country?: string | null; employeeCount?: number }>;
  departments: Array<{ id: string; name: string; code: string }>;
  initialFilters?: Record<string, string | undefined>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input name="search" defaultValue={initialFilters.search ?? ""} placeholder="البحث" />
        <select name="department" defaultValue={initialFilters.department ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">الإدارة</option>
          {departments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
        </select>
        <Input name="hospital" defaultValue={initialFilters.hospital ?? ""} placeholder="المستشفى" />
        <select name="isActive" defaultValue={initialFilters.isActive ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">الحالة</option>
          <option value="true">نشط</option>
          <option value="false">غير نشط</option>
        </select>
        <div className="flex gap-2 md:col-span-2 xl:col-span-4">
          <Button type="submit">تطبيق</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/branches")}>إعادة تعيين</Button>
        </div>
      </form>

      <label className="grid max-w-md gap-2 text-sm">
        <span className="font-medium text-muted-foreground">اختر فرع</span>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) router.push(`/branches/${event.target.value}`);
          }}
        >
          <option value="">قائمة الفروع الموجودة</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.code}) - {branch.employeeCount ?? 0} موظف
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
