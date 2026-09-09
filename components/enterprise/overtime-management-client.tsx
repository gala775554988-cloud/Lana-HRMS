"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock3, Coins, Download, Eye, Plus, ShieldCheck, XCircle } from "lucide-react";
import { ApprovalTimeline } from "@/components/enterprise/approval-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EmployeeOption = { id: string; employeeNumber: string; firstName: string; lastName: string; departmentId?: string | null; branchId?: string | null; department?: { name: string } | null; branch?: { name: string } | null };
type RefOption = { id: string; name: string };
type OvertimeRow = { id: string; employeeId: string; workDate: string; hours: number; rate: number; amount: number; status: string; reason?: string | null; employee: EmployeeOption & { nationalId?: string; position?: { title: string } | null }; extra?: Record<string, unknown>; employeeExtra?: Record<string, unknown>; workflow?: { id: string; status: string; currentStep: number } | null };
type Stats = { total: number; pending: number; approved: number; rejected: number; approvedHours: number; approvedAmount: number };

const emptyStats: Stats = { total: 0, pending: 0, approved: 0, rejected: 0, approvedHours: 0, approvedAmount: 0 };
const statusLabel: Record<string, string> = { PENDING: "بانتظار الاعتماد", APPROVED: "معتمد", REJECTED: "مرفوض", CANCELLED: "ملغي" };
const statusClass: Record<string, string> = { PENDING: "border-amber-200 bg-amber-50 text-amber-700", APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700", REJECTED: "border-rose-200 bg-rose-50 text-rose-700", CANCELLED: "border-slate-200 bg-slate-50 text-slate-600" };
const overtimeTypeLabel: Record<string, string> = { regular: "يوم عمل", night: "عمل ليلي", holiday: "عطلة / إجازة رسمية" };

export function OvertimeManagementClient() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<RefOption[]>([]);
  const [branches, setBranches] = useState<RefOption[]>([]);
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", month: "", hospital: "", department: "", branch: "" });
  const [form, setForm] = useState({ employeeId: "", workDate: new Date().toISOString().slice(0, 10), startTime: "17:00", endTime: "19:00", hours: "2", overtimeType: "regular", compensationMode: "PAY", notes: "", project: "", hospital: "", departmentId: "", branchId: "" });

  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === form.employeeId), [employees, form.employeeId]);
  const calculatedHours = useMemo(() => {
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return Number(form.hours || 0);
    let minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes < 0) minutes += 1440;
    return Number((minutes / 60).toFixed(2));
  }, [form.endTime, form.hours, form.startTime]);
  const query = useMemo(() => { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); }); return params.toString(); }, [filters]);

  const load = useCallback(() => {
    fetch(`/api/enterprise/overtime?${query}`, { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (!data.success) throw new Error(data.message || "فشل تحميل العمل الإضافي");
      setRows(data.overtime ?? []); setStats(data.stats ?? emptyStats); setEmployees(data.employees ?? []); setDepartments(data.departments ?? []); setBranches(data.branches ?? []);
    }).catch((error) => { setMessageTone("error"); setMessage(error.message); });
  }, [query]);

  useEffect(() => { const timer = setTimeout(load, 300); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (selectedEmployee) setForm((current) => ({ ...current, departmentId: selectedEmployee.departmentId ?? "", branchId: selectedEmployee.branchId ?? "" })); }, [selectedEmployee]);
  function updateForm(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }

  function createOvertime() {
    startTransition(async () => {
      const response = await fetch("/api/enterprise/overtime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, hours: calculatedHours }) });
      const data = await response.json().catch(() => ({ success: false, message: "استجابة غير صالحة من الخادم" }));
      if (!data.success) { setMessageTone("error"); setMessage(data.message || "فشل حفظ العمل الإضافي"); return; }
      setMessageTone("success");
      setMessage(form.compensationMode === "TIME_OFF" ? `تم إرسال الطلب، وسيضاف ${Number((calculatedHours * 1.5).toFixed(2))} ساعة تعويضية بعد الاعتماد.` : `تم إرسال الطلب. القيمة التقديرية ${Number(data.amount ?? 0).toLocaleString("ar-SA")} ر.س`);
      setShowForm(false); setForm((current) => ({ ...current, employeeId: "", notes: "", project: "" })); load();
    });
  }

  function exportExcel() { const params = new URLSearchParams(query); params.set("export", "excel"); params.set("approved", "true"); window.location.href = `/api/enterprise/overtime?${params.toString()}`; }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="إجمالي الطلبات" value={stats.total} icon={Clock3} /><Metric label="بانتظار الاعتماد" value={stats.pending} icon={ShieldCheck} /><Metric label="الطلبات المعتمدة" value={stats.approved} icon={CheckCircle2} /><Metric label="المرفوضة" value={stats.rejected} icon={XCircle} /><Metric label="الساعات المعتمدة" value={stats.approvedHours.toLocaleString("ar-SA")} icon={Clock3} /><Metric label="القيمة المعتمدة" value={`${stats.approvedAmount.toLocaleString("ar-SA")} ر.س`} icon={Coins} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4"><div><CardTitle>طلبات العمل الإضافي</CardTitle><CardDescription>يمر كل طلب بمسار الاعتماد المحدد للموظف، ثم يصبح جاهزًا للمسير أو رصيد الإجازة التعويضية.</CardDescription></div><Button type="button" onClick={() => setShowForm((value) => !value)}><Plus className="me-2 h-4 w-4" />طلب جديد</Button></CardHeader>
        {showForm ? <CardContent className="border-t pt-5">
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-6 text-sky-800">يُحتسب المقابل المالي من الأجر الفعلي للساعة مضافًا إليه 50% من الأجر الأساسي للساعة. ويمكن اختيار رصيد إجازة تعويضية بدل المقابل المالي.</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select aria-label="الموظف" value={form.employeeId} onChange={(event) => updateForm("employeeId", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">اختر الموظف</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} - {employee.firstName} {employee.lastName}</option>)}</select>
            <Input aria-label="تاريخ العمل" type="date" value={form.workDate} onChange={(event) => updateForm("workDate", event.target.value)} /><Input aria-label="وقت البداية" type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} /><Input aria-label="وقت النهاية" type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} />
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">الساعات المحتسبة: </span><strong>{calculatedHours}</strong></div>
            <select aria-label="نوع العمل الإضافي" value={form.overtimeType} onChange={(event) => updateForm("overtimeType", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="regular">يوم عمل</option><option value="night">عمل ليلي</option><option value="holiday">عطلة / إجازة رسمية</option></select>
            <select aria-label="طريقة التعويض" value={form.compensationMode} onChange={(event) => updateForm("compensationMode", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="PAY">مقابل مالي</option><option value="TIME_OFF">إجازة تعويضية</option></select>
            <Input value={form.project} onChange={(event) => updateForm("project", event.target.value)} placeholder="المشروع / مركز التكلفة" /><Input value={form.hospital} onChange={(event) => updateForm("hospital", event.target.value)} placeholder="المستشفى / الموقع" />
            <select aria-label="الإدارة" value={form.departmentId} onChange={(event) => updateForm("departmentId", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">الإدارة</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
            <select aria-label="الفرع" value={form.branchId} onChange={(event) => updateForm("branchId", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">الفرع</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
            <Input value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="سبب العمل الإضافي (إجباري)" />
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button><Button disabled={isPending || !form.employeeId || !form.workDate || !form.notes.trim() || calculatedHours <= 0} onClick={createOvertime}>{isPending ? "جارٍ الإرسال..." : "إرسال للاعتماد"}</Button></div>
        </CardContent> : null}
      </Card>

      <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-7"><Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} aria-label="من تاريخ" /><Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} aria-label="إلى تاريخ" /><Input type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} aria-label="الشهر" /><Input value={filters.hospital} onChange={(event) => setFilters((current) => ({ ...current, hospital: event.target.value }))} placeholder="المستشفى" /><Input value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))} placeholder="الإدارة" /><Input value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))} placeholder="الفرع" /><Button type="button" variant="outline" onClick={exportExcel}><Download className="me-2 h-4 w-4" />تصدير المعتمد</Button></CardContent></Card>
      {message ? <div className={`rounded-xl border p-3 text-sm ${messageTone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div> : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
        <thead className="bg-muted/70 text-muted-foreground"><tr><th className="px-4 py-3 text-start">الموظف</th><th className="px-4 py-3 text-start">التاريخ والوقت</th><th className="px-4 py-3 text-start">الساعات</th><th className="px-4 py-3 text-start">التعويض</th><th className="px-4 py-3 text-start">القيمة</th><th className="px-4 py-3 text-start">الحالة</th><th className="px-4 py-3 text-start">المعالجة</th></tr></thead>
        <tbody>{rows.map((row) => { const compensationMode = String(row.extra?.compensationMode ?? "PAY"); return <tr key={row.id} className="border-t hover:bg-muted/25"><td className="px-4 py-3"><p className="font-semibold">{row.employee.firstName} {row.employee.lastName}</p><p className="text-xs text-muted-foreground">{row.employee.employeeNumber} · {row.employee.department?.name ?? "بلا إدارة"}</p></td><td className="px-4 py-3"><p>{new Date(row.workDate).toLocaleDateString("ar-SA")}</p><p className="text-xs text-muted-foreground">{String(row.extra?.startTime ?? "-")} — {String(row.extra?.endTime ?? "-")}</p></td><td className="px-4 py-3"><p className="font-bold">{row.hours}</p><p className="text-xs text-muted-foreground">{overtimeTypeLabel[String(row.extra?.overtimeType)] ?? "يوم عمل"}</p></td><td className="px-4 py-3">{compensationMode === "TIME_OFF" ? `${String(row.extra?.timeOffHours ?? 0)} ساعة إجازة` : "مقابل مالي"}</td><td className="px-4 py-3 font-semibold">{compensationMode === "TIME_OFF" ? "—" : `${Number(row.amount).toLocaleString("ar-SA")} ر.س`}</td><td className="px-4 py-3"><Badge variant="outline" className={statusClass[row.status]}>{statusLabel[row.status] ?? row.status}</Badge></td><td className="px-4 py-3">{row.workflow ? <Button size="sm" variant="outline" onClick={() => setWorkflowId(row.workflow!.id)}><Eye className="me-1.5 h-4 w-4" />التفاصيل والمسار</Button> : <span className="text-xs text-muted-foreground">اعتماد تلقائي</span>}</td></tr>; })}{rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">لا توجد طلبات عمل إضافي ضمن الفلاتر الحالية</td></tr> : null}</tbody>
      </table></div></div>
      <ApprovalTimeline workflowId={workflowId} onClose={() => setWorkflowId(null)} />
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span></CardContent></Card>;
}
