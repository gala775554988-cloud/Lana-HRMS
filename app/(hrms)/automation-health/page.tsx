import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HrEventTaskPolicy } from "@/components/enterprise/HrEventTaskPolicy";
import { AutomationRules } from "@/components/enterprise/automation-rules";
import { OdooRepairConsole } from "@/components/integrations/odoo-repair-console";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";

export const dynamic = "force-dynamic";

export default async function AutomationHealthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canApprovePayroll(session)) notFound();
  const [failed, migration, details, queue, syncs, lastCron] = await Promise.all([
    prisma.odooMigrationError.count({ where: { status: "OPEN" } }),
    prisma.odooMigrationJob.count({ where: { status: { in: ["FAILED", "COMPLETED_WITH_ERRORS"] } } }),
    prisma.integrationJob.count({ where: { type: "ODOO_EMPLOYEE_DETAIL_SYNC", status: { in: ["PENDING", "RETRY"] } } }),
    prisma.integrationQueue.count({ where: { status: { in: ["PENDING", "RETRY"] } } }),
    prisma.syncHistory.findMany({
      orderBy: { startedAt: "desc" }, take: 15,
      select: { id: true, entity: true, status: true, startedAt: true, finishedAt: true,
        pulled: true, createdCount: true, updatedCount: true, error: true }
    }),
    prisma.auditLog.findFirst({ where: { entity: "odoo", action: { in: ["ODOO_CRON_SYNC", "ODOO_CRON_SYNC_BLOCKED", "ODOO_CRON_SYNC_FAILED"] } }, orderBy: { createdAt: "desc" }, select: { action: true, createdAt: true } })
  ]);
  const cards = [
    { label: "أخطاء Odoo المفتوحة", value: failed },
    { label: "دفعات ترحيل تحتاج مراجعة", value: migration },
    { label: "ملفات موظفين بانتظار التحديث", value: details },
    { label: "مهام تكامل معلقة", value: queue }
  ];
  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-[#26352A]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">مركز الأتمتة ومراقبة المزامنة</h1>
          <p className="mt-1 text-sm text-slate-600">عرض مباشر من قاعدة البيانات، دون تعديل أرصدة أو تنفيذ عمليات مالية</p></div>
        <Link href="/odoo-migration" className="rounded-xl border border-[#A8D58D] bg-[#E8F4DF] px-4 py-2 text-sm font-semibold hover:bg-[#D9EDCC]">
          إدارة الترحيل
        </Link>
      </header>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">المزامنة المجدولة (كل 5 دقائق)</h2>
        <p className="mt-2 text-sm">{!lastCron ? "لا توجد عملية مجدولة موثقة بعد." : lastCron.action !== "ODOO_CRON_SYNC" ? "آخر محاولة لم تكتمل بنجاح." : Date.now() - lastCron.createdAt.getTime() > 600000 ? "تنبيه: مضى أكثر من عشر دقائق على آخر نجاح." : "آخر تشغيل ناجح خلال عشر دقائق."}</p>
        {lastCron && <p className="text-sm text-muted-foreground">{lastCron.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}</p>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => <article key={card.label} className="rounded-2xl border border-[#DCECD3] bg-[#F7FAF5] p-5 shadow-sm">
          <p className="text-sm text-slate-600">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{card.value.toLocaleString("ar-SA")}</p>
        </article>)}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#DCECD3] bg-white shadow-sm">
        <div className="border-b border-[#E8F4DF] p-5"><h2 className="text-lg font-semibold">آخر عمليات المزامنة</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm">
          <thead className="bg-[#F7FAF5] text-slate-600"><tr>
            <th className="p-3">القسم</th><th className="p-3">الحالة</th><th className="p-3">تاريخ البدء</th>
            <th className="p-3">تم جلبها</th><th className="p-3">جديد</th><th className="p-3">محدث</th>
          </tr></thead>
          <tbody>{syncs.map(sync => <tr key={sync.id} className="border-t border-[#EDF3E9]">
            <td className="p-3">{sync.entity}</td>
            <td className="p-3"><span className={sync.status === "COMPLETED" ? "text-green-700" : sync.status === "RUNNING" ? "text-amber-700" : "text-red-700"}>{sync.status}</span></td>
            <td className="p-3">{sync.startedAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}</td>
            <td className="p-3 tabular-nums">{sync.pulled}</td>
            <td className="p-3 tabular-nums">{sync.createdCount}</td>
            <td className="p-3 tabular-nums">{sync.updatedCount}</td>
          </tr>)}</tbody>
        </table></div>
        {!syncs.length && <p className="p-6 text-center text-slate-500">لم تُسجل عمليات مزامنة بعد.</p>}
      </section>
      <AutomationRules/>
      <HrEventTaskPolicy/>
      <OdooRepairConsole/>
      <p className="text-xs text-slate-500">تعمل الجدولة الخارجية بعد نشر الإصدار النهائي وتهيئة سر المزامنة وتفعيل الجدولة. لا يعد وجود الإعداد دليلاً على التشغيل.</p>
    </main>
  );
}
