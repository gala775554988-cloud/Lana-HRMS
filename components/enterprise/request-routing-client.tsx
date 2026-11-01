"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowLeft, CheckCircle2, Plus, Save, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserSearchSelect } from "@/components/hrms/user-search-select";
import { REQUEST_CATEGORIES, STAGE_LABELS, defaultRoutingRule, stagesForRule, type RoutingRule, type RoutingStage } from "@/config/request-routing";

type PreviewStage = { order: number; name: string; approver: string; mandatory: boolean };
export function RequestRoutingClient() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("LEAVE");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [preview, setPreview] = useState<PreviewStage[] | null>(null);
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/enterprise/request-routing", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "تعذر تحميل إعداد المسارات.");
      setRules(data.rules); setVersion(data.version); setCompanies(data.companies); setLabels(data.labels);
    }).catch(reason => { if (reason.name !== "AbortError") { setError(true); setMessage(reason.message); } }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const rule = rules.find(item => item.requestType === selected && item.companyId === companyId) ?? { ...(rules.find(item => item.requestType === selected && !item.companyId) ?? defaultRoutingRule(selected)), companyId };
  function update(patch: Partial<RoutingRule>) {
    const next = { ...rule, ...patch };
    setRules(current => [...current.filter(item => !(item.requestType === next.requestType && item.companyId === next.companyId)), next]);
    setDirty(true); setPreview(null); setPreviewMessage(""); setMessage("");
  }
  function changeStage(index: number, patch: Partial<RoutingStage>) { update({ stages: rule.stages.map((stage, i) => i === index ? { ...stage, ...patch } : stage) }); }
  function move(index: number, delta: -1 | 1) {
    const stages = [...rule.stages]; const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    [stages[index], stages[target]] = [stages[target], stages[index]]; update({ stages });
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/enterprise/request-routing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules, version }) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || "لم تُحفظ المسارات.");
      setVersion(data.version); setDirty(false); setError(false); setMessage(data.message);
    } catch (reason) { setError(true); setMessage((reason as Error).message); } finally { setBusy(false); }
  }
  async function previewRoute() {
    setPreviewBusy(true); setPreviewMessage(""); setPreview(null);
    try {
      const response = await fetch("/api/enterprise/request-routing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, rule }) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || "تعذرت معاينة المسار.");
      setPreview(data.stages);
    } catch (reason) { setPreviewMessage((reason as Error).message); } finally { setPreviewBusy(false); }
  }
  if (loading) return <div className="rounded-2xl border bg-card p-8 text-center" role="status">جارٍ تحميل مسارات الاعتماد...</div>;
  if (!rules.length) return <div className="rounded-2xl border bg-card p-6" role="alert">{message || "تعذر تحميل المسارات."}</div>;
  return <div className="space-y-5" dir="rtl">
    <header className="rounded-2xl border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Workflow className="h-5 w-5" />مسارات اعتماد الطلبات</h2><p className="mt-2 text-sm text-muted-foreground">اختر نوع الطلب وحدد من يستلمه وبأي ترتيب. ينتقل الطلب إلى المرحلة التالية بعد اعتماد المرحلة الحالية فقط. عند غياب مدير نشط مرتبط بحساب، ينتقل إلى مرحلة HR إن كانت ضمن المسار.</p><p className="mt-2 text-xs text-muted-foreground">المسار الخاص بالمستشفى أو القسم أو الفرع يتقدم على المسار العام. التغييرات تخص الطلبات الجديدة؛ تبقى الطلبات الجارية بسجلها ومسارها المحفوظ.</p><Link href="/approvals?tab=paths" className="mt-3 inline-block text-sm text-primary underline">المسارات الخاصة بالجهات التنظيمية</Link></header>
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      <aside className="space-y-3 rounded-2xl border bg-card p-4"><Label htmlFor="routing-company">نطاق التطبيق</Label><select id="routing-company" value={companyId ?? ""} onChange={event => { setCompanyId(event.target.value || null); setPreview(null); }} className="h-10 w-full rounded-xl border bg-background px-2 text-sm"><option value="">كل الشركات · المسار العام</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select><div className="flex flex-wrap gap-2 lg:flex-col" role="tablist" aria-label="أنواع الطلبات">{REQUEST_CATEGORIES.map(category => <button type="button" role="tab" aria-selected={selected === category.code} key={category.code} onClick={() => { setSelected(category.code); setPreview(null); setPreviewMessage(""); }} className={`rounded-xl px-3 py-2 text-start text-sm ${selected === category.code ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{category.label}</button>)}</div></aside>
      <section className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6" aria-label="إعداد المسار">
        <h3 className="font-bold">{REQUEST_CATEGORIES.find(category => category.code === selected)?.label}</h3>
        <div className="space-y-2"><Label htmlFor="routing-mode">طريقة توجيه الطلب</Label><select id="routing-mode" value={rule.mode} onChange={event => { const mode = event.target.value as RoutingRule["mode"]; update({ mode, stages: mode === "CUSTOM" ? stagesForRule(rule) : [] }); }} className="h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="MANAGER_HR">المدير المباشر ثم الموارد البشرية</option><option value="HIERARCHY_HR">التسلسل الإداري ثم الموارد البشرية</option><option value="HR_DIRECT">الموارد البشرية مباشرة</option><option value="CUSTOM">مسار مخصص · ترتيب المعتمدين</option></select></div>
        <ol className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-3" aria-label="تسلسل المسار">{stagesForRule(rule).map((stage, index) => <li className="flex items-center gap-2 text-sm" key={index}><span className="rounded-xl border bg-card px-3 py-2">{index + 1}. {stage.name || STAGE_LABELS[stage.kind]}</span>{index < stagesForRule(rule).length - 1 ? <ArrowLeft className="h-4 w-4" /> : null}</li>)}</ol>
        {stagesForRule(rule).some(stage => stage.kind === "MANAGER_CHAIN") ? <div className="space-y-2"><Label htmlFor="manager-levels">أقصى عدد مستويات إدارية</Label><Input id="manager-levels" type="number" min={1} max={20} value={rule.maxManagerLevels} onChange={event => update({ maxManagerLevels: Number(event.target.value) })} /></div> : null}
        {stagesForRule(rule).some(stage => stage.kind === "HR") ? <div className="space-y-2"><Label>مسؤول الموارد البشرية</Label><UserSearchSelect value={rule.hrEmployeeId || ""} initialLabel={labels[rule.hrEmployeeId || ""] || ""} placeholder="اتركه للتوجيه التلقائي، أو ابحث عن مسؤول HR محدد" onChange={(_user, label, employee) => { if (employee?.id && label) setLabels(current => ({ ...current, [employee.id]: label })); update({ hrEmployeeId: employee?.id || null }); }} /><p className="text-xs text-muted-foreground">عند عدم تحديد شخص، يُختار حساب HR نشط. عند غيابه يصل الطلب للإدارة البديلة، ولا يُعتمد تلقائياً.</p></div> : null}
        {rule.mode === "CUSTOM" ? <div className="space-y-3">{rule.stages.map((stage, index) => <div key={index} className="space-y-3 rounded-2xl border p-3"><div className="flex items-center gap-2"><span className="text-sm font-bold">{index + 1}</span><select value={stage.kind} onChange={event => changeStage(index, { kind: event.target.value as RoutingStage["kind"], employeeId: undefined })} aria-label={`نوع المرحلة ${index + 1}`} className="min-w-0 flex-1 rounded-xl border bg-background p-2 text-sm">{Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button type="button" variant="ghost" size="icon" aria-label={`رفع المرحلة ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`خفض المرحلة ${index + 1}`} disabled={index === rule.stages.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`حذف المرحلة ${index + 1}`} onClick={() => update({ stages: rule.stages.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div><Input value={stage.name || ""} placeholder="اسم المرحلة (اختياري)" onChange={event => changeStage(index, { name: event.target.value })} />{stage.kind === "EMPLOYEE" ? <UserSearchSelect value={stage.employeeId || ""} initialLabel={labels[stage.employeeId || ""] || ""} placeholder="اختر المعتمد لهذه المرحلة" onChange={(_user, label, employee) => { if (employee?.id && label) setLabels(current => ({ ...current, [employee.id]: label })); changeStage(index, { employeeId: employee?.id }); }} /> : null}</div>)}<Button type="button" variant="outline" disabled={rule.stages.length >= 12} onClick={() => update({ stages: [...rule.stages, { kind: "EMPLOYEE" }] })}><Plus className="me-2 h-4 w-4" />إضافة مرحلة</Button></div> : null}
        <div className="space-y-2"><Label htmlFor="routing-sla">المدة المستهدفة لإنجاز الطلب (ساعة)</Label><Input id="routing-sla" type="number" min={1} max={720} value={rule.slaHours} onChange={event => update({ slaHours: Number(event.target.value) })} /><p className="text-xs text-muted-foreground">معيار متابعة داخلي، وليس موافقة تلقائية عند انقضائه ولا بديلاً عن المواعيد النظامية.</p></div>
        <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">معاينة المسار لموظف</h4><UserSearchSelect value={employeeId} onChange={(_user, _label, employee) => { setEmployeeId(employee?.id || ""); setPreview(null); }} /><Button type="button" variant="outline" disabled={!employeeId || previewBusy} onClick={previewRoute}>{previewBusy ? "جارٍ تحديد المعتمدين..." : "معاينة المعتمدين الفعليين"}</Button>{previewMessage ? <p role="alert" className="text-sm text-destructive">{previewMessage}</p> : null}{preview ? <ol className="space-y-2">{preview.map(stage => <li key={stage.order} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" /><span>{stage.order}. {stage.name} · {stage.approver} {stage.mandatory ? "" : "(للاطلاع)"}</span></li>)}</ol> : null}</div>
      </section>
    </div>
    <section className="rounded-2xl border bg-card p-4 text-sm"><h3 className="font-semibold">ضوابط المراجعة</h3><p className="mt-2 text-muted-foreground">لا موافقة ذاتية، ولا انتقال لمرحلة لاحقة قبل إنهاء الحالية، وسبب الرفض أو الإرجاع إلزامي. تبقى الإجازة بنوعها المسجل ولا تتحول تلقائياً إلى إجازة أخرى. الاستحقاقات والأجور تُراجع وفق نظام العمل ولائحة المنشأة؛ ترتيب المعتمدين إجراء داخلي قابل للضبط.</p><a href="https://www.hrsd.gov.sa/شروط-العمل-وظروفه" target="_blank" rel="noreferrer" className="mt-2 inline-block text-primary underline">مرجع وزارة الموارد البشرية: نظام العمل</a></section>
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-lg"><p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{message || (dirty ? "توجد تعديلات لم تُحفظ." : "الإعدادات الحالية جاهزة.")}</p><Button type="button" onClick={save} disabled={busy || !dirty}><Save className="me-2 h-4 w-4" />{busy ? "جارٍ الحفظ..." : "حفظ مسارات الاعتماد"}</Button></div>
  </div>;
}
