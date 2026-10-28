"use client";
import { useState } from "react";
type Job = { id: string; title: string; department: string; description: string | null };
export function ApplicationForm({ jobs, token }: { jobs: Job[]; token: string }) {
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const input = "w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900";
  return <form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const response = await fetch("/api/careers/apply", { method: "POST", body: new FormData(event.currentTarget) }); const data = await response.json(); setMessage(data.message); setDone(response.ok); } catch { setMessage("تعذر الاتصال. حاول مجددًا."); } finally { setBusy(false); }
  }}>
    <input type="hidden" name="token" value={token} /><input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    {done ? <p role="status" className="rounded-xl bg-emerald-50 p-5 text-emerald-900">{message}</p> : <>
    <label className="block">الوظيفة المطلوبة<select name="jobOpeningId" required className={input} value={selected} onChange={e => setSelected(e.target.value)}><option value="">اختر الوظيفة والقسم</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} — {job.department}</option>)}</select></label>
    {selected && <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4">{jobs.find(j => j.id === selected)?.description || "يراجع فريق التوظيف الطلبات وفق متطلبات الوظيفة."}</p>}
    <div className="grid gap-4 sm:grid-cols-2">{[["firstName", "الاسم الأول", "text"], ["lastName", "اسم العائلة", "text"], ["email", "البريد الإلكتروني", "email"], ["phone", "رقم الجوال", "tel"]].map(([name, label, type]) => <label key={name}>{label}<input name={name} type={type} required maxLength={200} className={input} /></label>)}</div>
    <label className="block">السيرة الذاتية — PDF، حتى ٢ ميجابايت<input name="resume" type="file" required accept="application/pdf,.pdf" className={input} /></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />أوافق على حفظ بياناتي وسيرتي الذاتية ومراجعتها لأغراض التوظيف. قد تستخدم الجهة تحليلًا مساعدًا بالذكاء الاصطناعي؛ القرار النهائي لفريق التوظيف.</label>
    <button disabled={busy || !jobs.length || !token} className="w-full rounded-xl bg-indigo-700 p-3 font-bold text-white disabled:opacity-50">{busy ? "جارٍ حفظ الطلب…" : "إرسال طلب التوظيف"}</button>
    <p role="status">{message}</p></>}
  </form>;
}
