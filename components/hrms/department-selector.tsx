"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function DepartmentSelector({
  departments,
  employees = [],
  label = "الإدارات"
}: {
  departments: Array<{ id: string; name: string; code: string }>;
  employees?: Array<{ id: string; employeeNumber: string; nationalId: string; firstName: string; lastName: string; departmentId: string | null }>;
  label?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();

  const filteredDepartments = useMemo(() => {
    if (!normalizedSearch) return departments;
    const matchingDepartmentIds = new Set(
      employees
        .filter((employee) => [employee.employeeNumber, employee.nationalId, employee.firstName, employee.lastName, `${employee.firstName} ${employee.lastName}`]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch))
        .map((employee) => employee.departmentId)
        .filter((id): id is string => Boolean(id))
    );
    return departments.filter((department) =>
      department.name.toLowerCase().includes(normalizedSearch) ||
      department.code.toLowerCase().includes(normalizedSearch) ||
      matchingDepartmentIds.has(department.id)
    );
  }, [departments, employees, normalizedSearch]);

  return (
    <div className="grid max-w-2xl gap-3 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث باسم الإدارة أو الرمز أو اسم الموظف أو الرقم الوظيفي أو رقم الهوية" />
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm"
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) router.push(`/departments/${event.target.value}${search ? `?search=${encodeURIComponent(search)}` : ""}`);
        }}
      >
        <option value="">اختر إدارة</option>
        {filteredDepartments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name} ({department.code})
          </option>
        ))}
      </select>
    </div>
  );
}
