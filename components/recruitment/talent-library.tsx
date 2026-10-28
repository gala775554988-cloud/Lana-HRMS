"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { compareCandidates } from "@/lib/recruitment/actions";
type Candidate = { id: string; name: string; job: string; department: string; status: string; hasResume: boolean };
export function TalentLibrary({ candidates, jobs, total, page }: { candidates: Candidate[]; jobs: { id: string; title: string }[]; total: number; page: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const labels: Record<string, string> = { APPLIED: "طلب جديد", SCREENING: "المراجعة", INTERVIEW: "المقابلة", OFFERED: "عرض وظيفي", HIRED: "تم التوظيف", REJECTED: "مغلق" };
  return <section className="space-y-5"><div className="rounded-2xl border bg-indigo-50 p-5 text-slate-900"><h2 className="text-lg font-bold">مقارنة السير المحددة بالذكاء الاصطناعي</h2><p className="my-2 text-sm">حدد ٢–٨ سير واختر وظيفة مرجعية. تُرسل ملفات PDF المحددة إلى Gemini لتحليل المتطلبات والأدلة؛ راجع النتيجة قبل اتخاذ القرار.</p><select aria-label="الوظيفة المرجعية للمقارنة" value={jobId} onChange={e => setJobId(e.target.value)} className="rounded-xl border bg-white p-3"><option value="">اختر وظيفة مرجعية</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select><button disabled={busy || selected.length < 2 || !jobId} onClick={async () => { setBusy(true); setMessage(""); setAnswer(""); try { const result = await compareCandidates({ ids: selected, jobId }); if (result.error) setMessage(result.error); else { setAnswer(result.answer || ""); setOrder(result.order || []); } } catch { setMessage("تعذرت المقارنة. حاول مجددًا."); } finally { setBusy(false); } }} className="m-2 rounded-xl bg-indigo-700 px-5 py-3 text-white disabled:opacity-50">{busy ? "جارٍ تحليل الأدلة…" : `مقارنة المحدد (${selected.length})`}</button><p role="status">{message}</p></div>
  <p>{total} سيرة ذاتية وطلب توظيف · الصفحة {page}</p><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-right text-sm"><thead className="bg-slate-100"><tr>{["تحديد", "المرشح", "الوظيفة", "القسم", "الحالة", "السيرة الذاتية"].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{candidates.map(c => <tr key={c.id} className="border-t"><td className="p-4"><input type="checkbox" aria-label={`تحديد ${c.name}`} checked={selected.includes(c.id)} disabled={!selected.includes(c.id) && selected.length >= 8} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} /></td><td className="p-4">{c.name}</td><td className="p-4">{c.job}</td><td className="p-4">{c.department}</td><td className="p-4">{labels[c.status] || "قيد المراجعة"}</td><td className="p-4">{c.hasResume ? <a className="text-indigo-700 underline" href={`/api/recruitment/resume/${c.id}`}>تنزيل PDF</a> : "غير مرفقة"}</td></tr>)}</tbody></table>{!candidates.length && <p className="p-8">لا توجد طلبات مطابقة للفلاتر.</p>}</div>
  {answer && <article className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="font-bold">نتيجة مساعدة للمراجعة البشرية</h2><ol>{order.map((id, i) => <li key={id}>المرشح {i + 1}: {candidates.find(c => c.id === id)?.name || "مرشح محدد"}</li>)}</ol><div className="space-y-3 overflow-x-auto"><ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown></div></article>}
  </section>;
}
