import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WorkflowPathEditor } from "@/components/enterprise/workflow-path-editor";

export default async function WorkflowPathsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) redirect("/analytics");

  return (
    <div className="space-y-8 p-4 sm:p-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">محرر مسارات الموافقات</h1>
        <p className="mt-1 text-sm text-muted-foreground">اضبط سلسلة الاعتماد لكل مسار؛ يتم حفظ كل مسار كاملاً عند الضغط على "حفظ".</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">المسار الأول: مسار طلبات المستشفيات</h2>
        <WorkflowPathEditor workflowType="HOSPITAL_PATH" defaultName="مسار طلبات المستشفيات" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">المسار الثاني: المسار الإداري العام</h2>
        <WorkflowPathEditor workflowType="GENERAL_ADMIN_PATH" defaultName="المسار الإداري العام" />
      </section>
    </div>
  );
}
