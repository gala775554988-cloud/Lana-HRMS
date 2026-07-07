"use client";

import { useRouter } from "next/navigation";

export function DepartmentSelector({
  departments,
  label = "الإدارات"
}: {
  departments: Array<{ id: string; name: string; code: string }>;
  label?: string;
}) {
  const router = useRouter();

  return (
    <label className="grid max-w-md gap-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm"
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) router.push(`/departments/${event.target.value}`);
        }}
      >
        <option value="">اختر إدارة</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name} ({department.code})
          </option>
        ))}
      </select>
    </label>
  );
}
