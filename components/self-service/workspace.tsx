"use client";
import { useEffect, useState } from "react";
import { ApprovalTimeline } from "@/components/enterprise/approval-timeline";
import { REQUEST_TYPE_CONFIG, getRequestTypeConfig } from "@/lib/employee/request-form-config";
import { Button } from "@/components/ui/button";
import { parseWorkflowStepMetadata } from "@/lib/enterprise/workflow-step-metadata";

type Row = { id: string; type: string; status: string; currentStep: number; createdAt: string; steps: { step: number; comments: string | null }[] };
const labels: Record<string, string> = { PENDING: "قيد الانتظار", COMPLETED: "معتمد", REJECTED: "مرفوض", RETURNED: "معاد للتعديل", CANCELLED: "ملغى" };
const inputClass = "w-full rounded-xl border bg-background px-3 py-2 text-sm";
export function SelfServiceWorkspace() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState("LEAVE");
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string; code: string }[]>([]);
  const [timeline, setTimeline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const config = getRequestTypeConfig(type)!;
  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/self-service?page=${page}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "تعذر تحميل الطلبات");
      setRows(data.requests); setTotal(data.total); setLeaveTypes(data.leaveTypes);
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(row: Row, action: string, data?: Record<string, string>) {
    const reason = action === "REVOKE" ? window.prompt("اكتب سبب طلب الاسترداد؛ لن يُلغى الطلب حتى موافقة المسؤول") : undefined;
    if (action === "REVOKE" && !reason) return;
    if (action === "CANCEL" && !window.confirm("هل تريد إلغاء الطلب؟ سيُحتفظ بسجله للتدقيق.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/self-service/${row.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "تعذر تنفيذ الإجراء");
      setMessage("تم تنفيذ الإجراء وإرسال إشعار للمسؤول عند الحاجة"); setEditing(null); setValues({}); await load();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function edit(row: Row) {
    setBusy(true);
    try {
      const response = await fetch(`/api/self-service/${row.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error("تعذر تحميل بيانات الطلب");
      setType(row.type); setEditing(row);
      const record = data.record;
      const fields: Record<string, string> = {};
      for (const field of getRequestTypeConfig(row.type)?.fields ?? []) {
        if (field.name === "leaveType" || field.name === "letterType" || field.name === "resumptionType") continue;
        const key = row.type === "LOAN" && field.name === "amount" ? "principalAmount" : field.name;
        fields[key] = field.kind === "date" ? String(record[key] ?? "").slice(0, 10) : String(record[key] ?? "");
      }
      setValues(fields);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editing) return act(editing, editing.status === "RETURNED" ? "RESUBMIT" : "EDIT", values);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/hr/my-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...values }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message ?? data.error?.message ?? "تعذر تقديم الطلب");
      setValues({}); setMessage("تم تقديم الطلب لمسار الاعتماد"); await load();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6" dir="rtl">
    <div><h1 className="text-2xl font-bold">الخدمات الذاتية</h1><p className="mt-2 text-sm text-muted-foreground">قدّم طلباتك، تابع مكانها الحالي وراجع القرارات وأسبابها.</p></div>
    {message && <p role="status" className="rounded-2xl border bg-muted p-4 text-sm">{message}</p>}
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{editing ? "تعديل الطلب وإعادة إرساله من بداية مسار الاعتماد" : "تقديم طلب جديد"}</h2>
      <label className="block space-y-2"><span>الخدمة</span><select className={inputClass} disabled={!!editing || busy} value={type} onChange={event => { setType(event.target.value); setValues({}); }}>{REQUEST_TYPE_CONFIG.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">{config.fields.filter(field => !editing || !["leaveType", "letterType", "resumptionType"].includes(field.name)).map(field => {
        const name = editing && type === "LOAN" && field.name === "amount" ? "principalAmount" : field.name;
        const props = { id: `request-${name}`, name, value: values[name] ?? "", required: field.required, disabled: busy, className: inputClass, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(current => ({ ...current, [name]: event.target.value })) };
        return <label key={name} htmlFor={props.id} className="block space-y-2 text-sm"><span>{field.label}</span>{field.kind === "textarea" ? <textarea {...props} maxLength={4000} /> : field.kind === "select" ? <select {...props}><option value="">اختر</option>{(name === "leaveType" ? leaveTypes.map(item => ({ value: item.code, label: item.name })) : field.options ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input {...props} type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"} step={field.kind === "number" ? "0.01" : undefined} />}</label>;
      })}</div>
      <div className="flex gap-2"><Button disabled={busy}>{busy ? "جارٍ التنفيذ…" : editing ? "حفظ وإعادة إرسال" : "تقديم الطلب"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setValues({}); }}>تراجع</Button>}</div>
    </form>
    <div className="space-y-3" aria-busy={loading}>
      <h2 className="font-semibold">طلباتي ({total})</h2>
      {loading ? <p>جارٍ التحميل…</p> : !rows.length ? <p className="text-muted-foreground">لا توجد طلبات حتى الآن.</p> : rows.map(row => <article key={row.id} className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{row.type === "REVOKE" ? "طلب استرداد بعد الاعتماد" : getRequestTypeConfig(row.type)?.label ?? row.type}</h3><p className="mt-1 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} · {row.id}</p></div><span className="rounded-full bg-muted px-3 py-1 text-sm">{labels[row.status] ?? row.status}</span></div>
        {row.status === "PENDING" && <p className="mt-3 text-sm text-primary">عند: {parseWorkflowStepMetadata(row.steps.find(step => step.step === row.currentStep)?.comments).stageName ?? `المرحلة ${row.currentStep}`}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTimeline(row.id)}>أين وصل الطلب؟</Button>{row.type !== "REVOKE" && <>{["PENDING", "RETURNED"].includes(row.status) && <><Button variant="outline" disabled={busy} onClick={() => void edit(row)}>{row.status === "RETURNED" ? "تصحيح وإعادة إرسال" : "تعديل"}</Button><Button variant="outline" disabled={busy} onClick={() => void act(row, "CANCEL")}>إلغاء</Button></>}{row.status === "COMPLETED" && <Button variant="outline" disabled={busy} onClick={() => void act(row, "REVOKE")}>طلب استرداد / إلغاء بعد الاعتماد</Button>}</>}</div>
      </article>)}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>السابق</Button><span>{page}</span><Button variant="outline" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)}>التالي</Button></div>
    </div>
    <ApprovalTimeline workflowId={timeline} onClose={() => setTimeline(null)} />
  </div>;
}
