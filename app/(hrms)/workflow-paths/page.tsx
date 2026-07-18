import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WorkflowPathsTabs } from "@/components/enterprise/workflow-paths-tabs";

export default async function WorkflowPathsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) redirect("/analytics");

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">محرر مسارات الموافقات</h1>
        <p className="mt-1 text-sm text-muted-foreground">اضبط سلسلة الاعتماد لكل مسار؛ يتم حفظ كل مسار كاملاً عند الضغط على "حفظ".</p>
      </div>

      <WorkflowPathsTabs />
    </div>
  );
}
