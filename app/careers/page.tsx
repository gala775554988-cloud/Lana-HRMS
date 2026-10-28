import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { applicationToken } from "@/lib/recruitment/application-token";
import { ApplicationForm } from "@/components/recruitment/application-form";
export const dynamic = "force-dynamic";
export default async function CareersPage() {
  const [jobs, departments] = await Promise.all([prisma.jobOpening.findMany({ where: { status: "OPEN", closedAt: null }, select: { id: true, title: true, departmentId: true, description: true }, orderBy: { openedAt: "desc" }, take: 200 }), prisma.department.findMany({ select: { id: true, name: true } })]);
  const names = new Map(departments.map(d => [d.id, d.name]));
  return <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900"><div className="mx-auto max-w-3xl"><Link href="/" className="font-bold text-indigo-700">Lana · لانا</Link><h1 className="mt-8 text-4xl font-bold">خطوتك المهنية القادمة تبدأ هنا</h1><p className="my-5 text-slate-600">اختر الوظيفة وأرفق سيرتك الذاتية. لا تحتاج إلى حساب للتقديم.</p><section className="rounded-3xl border bg-white p-6 shadow-sm sm:p-10"><h2 className="mb-6 text-2xl font-bold">التقديم على وظيفة</h2>{!jobs.length && <p className="mb-5">لا توجد وظائف مفتوحة حاليًا. يرجى زيارة الصفحة لاحقًا.</p>}<ApplicationForm token={applicationToken()} jobs={jobs.map(j => ({ ...j, department: names.get(j.departmentId || "") || "التوظيف العام" }))} /></section></div></main>;
}
