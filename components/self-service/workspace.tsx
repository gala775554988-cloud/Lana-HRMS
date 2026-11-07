"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [total, setTotal] = useState(0);
  const [type, setType] = useState("LEAVE");
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string; code: string }[]>([]);
  const [timeline, setTimeline] = useState<string | null>(null);
  const submission = useRef<{ body: string; key: string } | null>(null);
  const operationInProgress = useRef(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const config = getRequestTypeConfig(type)!;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const query = new URLSearchParams({ page: String(page), status: statusFilter, type: typeFilter });
        const response = await fetch(`/api/self-service?${query}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "تعذر تحميل الطلبات");
        if (controller.signal.aborted) return;
        setRows(data.requests);
        setTotal(data.total);
        setLeaveTypes(data.leaveTypes);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, statusFilter, typeFilter, refresh]);
  async function act(row: Row, action: string, data?: Record<string, string>) {
    if (operationInProgress.current) return;
    const reason = action === "REVOKE" ? window.prompt("اكتب سبب طلب الاسترداد؛ لن يُلغى الطلب حتى موافقة المسؤول") : undefined;
    if (action === "REVOKE" && !reason) return;
    if (action === "CANCEL" && !window.confirm("هل تريد إلغاء الطلب؟ سيُحتفظ بسجله للتدقيق.")) return;
    operationInProgress.current = true;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/self-service/${row.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "تعذر تنفيذ الإجراء");
      setMessage("تم تنفيذ الإجراء وإرسال إشعار للمسؤول عند الحاجة"); setEditing(null); setValues({}); setRefresh(current => current + 1);
    } catch (error) { setMessage((error as Error).message); }
    finally { operationInProgress.current = false; setBusy(false); }
  }
  async function edit(row: Row) {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setBusy(true);
    setMessage("");
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
      document.getElementById("request-form")?.focus();
    } catch (error) { setMessage((error as Error).message); }
    finally { operationInProgress.current = false; setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (operationInProgress.current) return;
    if (editing) return act(editing, editing.status === "RETURNED" ? "RESUBMIT" : "EDIT", values);
    operationInProgress.current = true;
    setBusy(true); setMessage("");
    try {
      const body = JSON.stringify({ type, ...values });
      if (submission.current?.body !== body) submission.current = { body, key: crypto.randomUUID() };
      const response = await fetch("/api/hr/my-requests", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.current.key }, body,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message ?? data.error?.message ?? "تعذر تقديم الطلب");
      submission.current = null;
      setValues({});
      setPage(1);
      setStatusFilter("");
      setTypeFilter("");
      setMessage("تم تقديم الطلب لمسار الاعتماد");
      setRefresh(current => current + 1);
    } catch (error) { setMessage((error as Error).message); }
    finally { operationInProgress.current = false; setBusy(false); }
  }
  return <div className="space-y-6" dir="rtl">
    <header className="lana-workspace-hero rounded-3xl p-6 sm:p-9">
      <p className="text-sm font-semibold text-indigo-200">مساحتي في Lana</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">الخدمات الذاتية</h1>
      <p className="mt-3 text-sm text-slate-200">قدّم طلبك وتابع مراحل المراجعة والقرارات من مكان واحد.</p>
      <nav aria-label="خدمات الموظف" className="mt-5 flex flex-wrap gap-2">
        {[["#my-requests", "متابعة الطلبات"], ["/employee/leave", "الإجازات"], ["/employee/salary", "الرواتب"], ["/employee/documents", "المستندات"], ["/employee/attendance", "الحضور"]].map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-3 text-sm font-semibold hover:bg-white/15">{label}</Link>
        ))}
      </nav>
    </header>
    {message && <p role="status" className="rounded-2xl border bg-muted p-4 text-sm">{message}</p>}
    <form id="request-form" tabIndex={-1} onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{editing ? "تعديل الطلب وإعادة إرساله من بداية مسار الاعتماد" : "تقديم طلب جديد"}</h2>
      <label className="block space-y-2"><span>الخدمة</span><select className={inputClass} disabled={!!editing || busy} value={type} onChange={event => { setType(event.target.value); setValues({}); }}>{REQUEST_TYPE_CONFIG.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">{config.fields.filter(field => !editing || !["leaveType", "letterType", "resumptionType"].includes(field.name)).map(field => {
        const name = editing && type === "LOAN" && field.name === "amount" ? "principalAmount" : field.name;
        const props = { id: `request-${name}`, name, value: values[name] ?? "", required: field.required, disabled: busy, className: inputClass, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(current => ({ ...current, [name]: event.target.value })) };
        return <label key={name} htmlFor={props.id} className="block space-y-2 text-sm"><span>{field.label}</span>{field.kind === "textarea" ? <textarea {...props} maxLength={4000} /> : field.kind === "select" ? <select {...props}><option value="">اختر</option>{(name === "leaveType" ? leaveTypes.map(item => ({ value: item.code, label: item.name })) : field.options ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input {...props} type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"} step={field.kind === "number" ? "0.01" : undefined} />}</label>;
      })}</div>
      <div className="flex gap-2"><Button disabled={busy}>{busy ? "جارٍ التنفيذ…" : editing ? "حفظ وإعادة إرسال" : "تقديم الطلب"}</Button>{editing && <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(null); setValues({}); }}>تراجع</Button>}</div>
    </form>
    <section id="my-requests" aria-labelledby="my-requests-heading" className="scroll-mt-20 space-y-3" aria-busy={loading}>
      <h2 id="my-requests-heading" className="text-xl font-bold">طلباتي</h2>
      <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>حالة الطلب</span><select className={inputClass} value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">كل الحالات</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>نوع الطلب</span><select className={inputClass} value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1); }}><option value="">كل الأنواع</option>{REQUEST_TYPE_CONFIG.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}<option value="REVOKE">استرداد بعد الاعتماد</option></select></label>
      </div>
      {!loading && !loadError && <p role="status" className="text-sm text-muted-foreground">الطلبات المطابقة: {total}</p>}
      {loading ? <p role="status">جارٍ التحميل…</p> : loadError ? <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><p role="alert">{loadError}</p><Button variant="outline" onClick={() => setRefresh(current => current + 1)}>إعادة المحاولة</Button></div> : !rows.length ? <p className="text-muted-foreground">{statusFilter || typeFilter ? "ما فيه طلبات تطابق الفلاتر." : "لا توجد طلبات حتى الآن."}</p> : rows.map(row => <article key={row.id} className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{row.type === "REVOKE" ? "طلب استرداد بعد الاعتماد" : getRequestTypeConfig(row.type)?.label ?? row.type}</h3><p className="mt-1 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} · {row.id}</p></div><span className="rounded-full bg-muted px-3 py-1 text-sm">{labels[row.status] ?? row.status}</span></div>
        {row.status === "PENDING" && <p className="mt-3 text-sm text-primary">عند: {parseWorkflowStepMetadata(row.steps.find(step => step.step === row.currentStep)?.comments).stageName ?? `المرحلة ${row.currentStep}`}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTimeline(row.id)}>أين وصل الطلب؟</Button>{row.type !== "REVOKE" && <>{["PENDING", "RETURNED"].includes(row.status) && <><Button variant="outline" disabled={busy} onClick={() => void edit(row)}>{row.status === "RETURNED" ? "تصحيح وإعادة إرسال" : "تعديل"}</Button><Button variant="outline" disabled={busy} onClick={() => void act(row, "CANCEL")}>إلغاء</Button></>}{row.status === "COMPLETED" && <Button variant="outline" disabled={busy} onClick={() => void act(row, "REVOKE")}>طلب استرداد / إلغاء بعد الاعتماد</Button>}</>}</div>
      </article>)}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>السابق</Button><span>{page}</span><Button variant="outline" disabled={page * 20 >= total || loading || Boolean(loadError)} onClick={() => setPage(page + 1)}>التالي</Button></div>
    </section>
    <ApprovalTimeline workflowId={timeline} onClose={() => setTimeline(null)} />
  </div>;
}
