import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { AttendanceConsole } from "@/components/hrms/attendance-console";
import { WorkspaceHeader } from "@/components/hrms/workspace-ui";
import { ModulePageBody } from "@/components/hrms/module-page-body";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const session = await auth();
  const roles = session?.user?.roles || [];
  const canCreate = roles.includes("HR_MANAGER") || hasPermission(session?.user?.permissions, {action:"create",resource:"attendance"}, roles);
  if (query.tab === "manual") return <div className="space-y-5"><Button asChild variant="outline"><Link href="/attendance">العودة إلى سجل الدوام</Link></Button><ModulePageBody resourceKey="attendance" query={query} showModuleTabs={false}/></div>;
  return <div className="space-y-5" dir="rtl">
    <WorkspaceHeader title="الحضور والانصراف" description="متابعة الدوام الفعلي ومراجعة الاستثناءات وإصدار كشوف الحضور من مكان واحد." actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/shifts"><CalendarClock className="me-2 h-4 w-4"/>الورديات وجدول المناوبات</Link></Button>{canCreate?<Button asChild><Link href="/attendance?tab=manual"><Plus className="me-2 h-4 w-4"/>إدخال / تصحيح يدوي</Link></Button>:null}</div>}/>
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border bg-card"/>}><AttendanceConsole/></Suspense>
  </div>;
}
