"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EmployeeOption = { id: string; employeeNumber: string; firstName: string; lastName: string; departmentId?: string | null; branchId?: string | null; department?: { name: string } | null; branch?: { name: string } | null };
type RefOption = { id: string; name: string };
type OvertimeRow = {
  id: string;
  employeeId: string;
  workDate: string;
  hours: number;
  rate: number;
  status: string;
  reason?: string | null;
  employee: EmployeeOption & { nationalId?: string; position?: { title: string } | null };
  extra?: Record<string, any>;
  employeeExtra?: Record<string, any>;
};

export function OvertimeManagementClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<RefOption[]>([]);
  const [branches, setBranches] = useState<RefOption[]>([]);
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState({ from: "", to: "", month: "", hospital: "", department: "", branch: "" });
  const [form, setForm] = useState({ employeeId: "", workDate: new Date().toISOString().slice(0, 10), startTime: "17:00", endTime: "19:00", hours: "2", overtimeType: "regular", notes: "", project: "", hospital: "", departmentId: "", branchId: "" });

  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === form.employeeId), [employees, form.employeeId]);
  const calculatedHours = useMemo(() => {
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return Number(form.hours || 0);
    let minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes < 0) minutes += 1440;
    return Number((minutes / 60).toFixed(2));
  }, [form.endTime, form.hours, form.startTime]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters]);

  const load = () => {
    fetch(`/api/enterprise/overtime?${query}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "فشل تحميل الأوفر تايم");
        setRows(data.overtime ?? []);
        setEmployees(data.employees ?? []);
        setDepartments(data.departments ?? []);
        setBranches(data.branches ?? []);
      })
      .catch((error) => setMessage(error.message));
  };

  useEffect(load, [query]);
  useEffect(() => {
    if (selectedEmployee) setForm((current) => ({ ...current, departmentId: selectedEmployee.departmentId ?? "", branchId: selectedEmployee.branchId ?? "" }));
  }, [selectedEmployee]);

  function updateForm(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createOvertime() {
    startTransition(async () => {
      const payload = { ...form, hours: calculatedHours };
      const response = await fetch("/api/enterprise/overtime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!data.success) {
        setMessage(data.message || "فشل حفظ الأوفر تايم");
        return;
      }
      setMessage(`تم إنشاء طلب الأوفر تايم. القيمة المحسوبة: ${data.amount ?? 0}`);
      load();
    });
  }

  function exportExcel() {
    const params = new URLSearchParams(query);
    params.set("export", "excel");
    params.set("approved", "true");
    window.location.href = `/api/enterprise/overtime?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />إضافة أوفر تايم</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={form.employeeId} onChange={(event) => updateForm("employeeId", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الموظف</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} - {employee.firstName} {employee.lastName}</option>)}
          </select>
          <Input type="date" value={form.workDate} onChange={(event) => updateForm("workDate", event.target.value)} />
          <Input type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} />
          <Input type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} />
          <Input type="number" step="0.01" value={calculatedHours} onChange={(event) => updateForm("hours", event.target.value)} placeholder="عدد الساعات" />
          <select value={form.overtimeType} onChange={(event) => updateForm("overtimeType", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="regular">عادي</option>
            <option value="night">ليلي</option>
            <option value="holiday">عطلة</option>
          </select>
          <Input value={form.project} onChange={(event) => updateForm("project", event.target.value)} placeholder="المشروع (اختياري)" />
          <Input value={form.hospital} onChange={(event) => updateForm("hospital", event.target.value)} placeholder="المستشفى" />
          <select value={form.departmentId} onChange={(event) => updateForm("departmentId", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الإدارة</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={form.branchId} onChange={(event) => updateForm("branchId", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">الفرع</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <Input value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="الملاحظات" />
          <Button type="button" disabled={isPending || !form.employeeId || !form.workDate} onClick={createOvertime}>حفظ وإرسال للموارد البشرية</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تصدير Excel</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} placeholder="من تاريخ" />
          <Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} placeholder="إلى تاريخ" />
          <Input type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} />
          <Input value={filters.hospital} onChange={(event) => setFilters((current) => ({ ...current, hospital: event.target.value }))} placeholder="المستشفى" />
          <Input value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))} placeholder="الإدارة" />
          <Input value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))} placeholder="الفرع" />
          <Button type="button" onClick={exportExcel} className="gap-2"><Download className="h-4 w-4" />تصدير Excel</Button>
        </CardContent>
      </Card>

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/70 text-muted-foreground"><tr><th className="px-4 py-3 text-start">الموظف</th><th className="px-4 py-3 text-start">التاريخ</th><th className="px-4 py-3 text-start">الساعات</th><th className="px-4 py-3 text-start">النوع</th><th className="px-4 py-3 text-start">القيمة</th><th className="px-4 py-3 text-start">الحالة</th><th className="px-4 py-3 text-start">المستشفى</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3">{row.employee.employeeNumber} - {row.employee.firstName} {row.employee.lastName}</td><td className="px-4 py-3">{new Date(row.workDate).toLocaleDateString("ar-SA")}</td><td className="px-4 py-3">{String(row.hours)}</td><td className="px-4 py-3">{String(row.extra?.overtimeType ?? "-")}</td><td className="px-4 py-3">{String(row.extra?.amount ?? 0)}</td><td className="px-4 py-3">{row.status}</td><td className="px-4 py-3">{String(row.extra?.hospital ?? row.employeeExtra?.hospital ?? "-")}</td></tr>)}
              {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">لا توجد سجلات أوفر تايم</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
