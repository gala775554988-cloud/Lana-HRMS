import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { TalentLibrary } from "@/components/recruitment/talent-library";
import type { Prisma } from "@prisma/client";
export const dynamic = "force-dynamic";
export default async function TalentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission({ action: "read", resource: "recruitment" });
  const query = await searchParams;
  const jobId = typeof query.job === "string" ? query.job : "";
  const departmentId = typeof query.department === "string" ? query.department : "";
  const search = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(String(query.page), 10) || 1));
  const where: Prisma.CandidateWhereInput = { ...(jobId ? { jobOpeningId: jobId } : {}), ...(departmentId ? { jobOpening: { departmentId } } : {}), ...(search ? { OR: ["firstName", "lastName", "email"].map(key => ({ [key]: { contains: search, mode: "insensitive" } })) } : {}) };
  const [candidates, total, jobs, departments] = await Promise.all([
    prisma.candidate.findMany({ where, select: { id: true, firstName: true, lastName: true, status: true, jobOpening: { select: { title: true, departmentId: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30 }),
    prisma.candidate.count({ where }), prisma.jobOpening.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" }, take: 500 }), prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);
  // Select only attachment presence, keeping large resume bodies off the list payload.
  const withResume = candidates.length ? await prisma.candidate.findMany({ where: { id: { in: candidates.map(c => c.id) }, resumeUrl: { not: null } }, select: { id: true } }) : [];
  const attached = new Set(withResume.map(c => c.id));
  const names = new Map(departments.map(d => [d.id, d.name]));
  const baseUrl = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://lana-hrms.vercel.app").replace(/\/$/, "");
  const applyUrl = `${baseUrl}/careers`;
  const qr = await QRCode.toDataURL(applyUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" });
  const pageHref = (value: number) => `/recruitment/talent?${new URLSearchParams({ job: jobId, department: departmentId, q: search, page: String(value) })}`;
  return <main dir="rtl" className="space-y-6 text-slate-900"><header className="rounded-2xl border bg-white p-6"><Link href="/recruitment" className="text-indigo-700">إدارة الوظائف ←</Link><h1 className="my-3 text-3xl font-bold">مكتبة السير الذاتية</h1><p>حفظ الطلبات، الفرز حسب الوظيفة والقسم، ومقارنة الأدلة المهنية.</p><details className="mt-4"><summary className="cursor-pointer font-bold text-indigo-700">باركود الاستاند ورابط التقديم المباشر</summary><div className="mt-4 flex flex-wrap items-center gap-5"><img src={qr} alt="باركود صفحة التقديم على الوظائف" width={240} height={240} /><div><a href={applyUrl} className="block underline" dir="ltr">{applyUrl}</a><a download="lana-careers-qr.png" href={qr} className="mt-3 inline-block rounded-xl bg-indigo-700 p-3 text-white">تنزيل الباركود للطباعة</a><p className="mt-3 text-sm">الباركود المطبوع سابقًا يحتاج أن يحمل هذا الرابط أو رابطًا يمكن تحويله إليه.</p></div></div></details></header>
  <form className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4"><input aria-label="البحث بالاسم أو البريد" name="q" defaultValue={search} placeholder="بحث بالاسم أو البريد" className="rounded-xl border p-3" /><select aria-label="القسم" name="department" defaultValue={departmentId} className="rounded-xl border p-3"><option value="">جميع الأقسام</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select aria-label="الوظيفة" name="job" defaultValue={jobId} className="rounded-xl border p-3"><option value="">جميع الوظائف</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select><button className="rounded-xl bg-indigo-700 px-6 text-white">بحث وفرز</button><Link href="/recruitment/talent" className="p-3">إلغاء الفلاتر</Link></form>
  <TalentLibrary key={`${jobId}:${departmentId}:${search}:${page}`} jobs={jobs} total={total} page={page} candidates={candidates.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, status: c.status, job: c.jobOpening?.title || "غير محددة", department: names.get(c.jobOpening?.departmentId || "") || "غير محدد", hasResume: attached.has(c.id) }))} />
  <nav className="flex gap-5" aria-label="صفحات الطلبات">{page > 1 && <Link href={pageHref(page - 1)}>السابق</Link>}{page * 30 < total && <Link href={pageHref(page + 1)}>التالي</Link>}</nav></main>;
}
