import Link from "next/link";
import { SelfServiceWorkspace } from "@/components/self-service/workspace";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { OdooRequestsWorkspace } from "@/components/enterprise/odoo-requests-workspace";
import { Inbox, Send, GitPullRequest, Workflow, RefreshCw } from "lucide-react";
import { auth } from "@/auth";
import { canManageApprovalRouting } from "@/config/request-routing";

const RequestWorkbenchClient = dynamicImport(() => import("@/components/enterprise/request-workbench-client").then((mod) => mod.RequestWorkbenchClient));

const ApprovalWorkflowsClient = dynamicImport(() => import("@/components/enterprise/approval-workflows-client").then(mod => mod.ApprovalWorkflowsClient));
const RequestRoutingClient = dynamicImport(() => import("@/components/enterprise/request-routing-client").then(mod => mod.RequestRoutingClient));

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (query.tab === "paths") redirect("/approvals?tab=routing&advanced=1");
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const ownEmployee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true, firstName: true, lastName: true, employeeNumber: true } });
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  const canConfigure = Boolean(session?.user && canManageApprovalRouting(session.user.roles, session.user.permissions));
  return (
    <div className="space-y-5" dir="rtl">
      <header className="lana-workspace-hero approvals-hero rounded-2xl p-5 sm:p-7">
        <p className="approvals-hero-eyebrow text-sm font-semibold">مساحة المسؤول في مدار HR</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">الطلبات والموافقات</h1>
        <p className="approvals-hero-description mt-3 max-w-3xl text-sm leading-7 sm:text-base">وارد الموظفين للمراجعة، والطلبات المرسلة لأودو لمتابعة التنفيذ، والمزامنة لإدارة الاتصال والاستيراد.</p>
        <Link href="/approvals?tab=new" className="approvals-hero-action mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">تقديم طلب جديد</Link>
      </header>
      <MergedModuleTabs
        defaultValue="center"
        items={[
        {
          value: "center",
          label: "طلبات الموظفين",
          icon: <GitPullRequest className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جارٍ تحميل الطلبات…</div>}><RequestWorkbenchClient mode="center" /></Suspense>
        },
        { value: "odoo", label: "الطلبات المرسلة لأودو", icon: <GitPullRequest className="h-4 w-4" />, content: query.tab === "odoo" ? <OdooRequestsWorkspace view="outbound" /> : null },
        { value: "sync", label: "مزامنة أودو", icon: <RefreshCw className="h-4 w-4" />, hidden: !canConfigure, content: canConfigure && query.tab === "sync" ? <OdooRequestsWorkspace view="sync" /> : null },
        {
          value: "new", label: "تقديم طلب جديد", icon: <Send className="h-4 w-4" />,
          content: <SelfServiceWorkspace administrative initialLeaveTypes={leaveTypes} ownEmployee={ownEmployee ? { id: ownEmployee.id, label: `${ownEmployee.firstName} ${ownEmployee.lastName} · ${ownEmployee.employeeNumber}` } : null} />
        },
        {
          value: "inbox",
          label: "بانتظار قراري",
          icon: <Inbox className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جارٍ تحميل الطلبات بانتظار قرارك…</div>}><RequestWorkbenchClient mode="inbox" /></Suspense>
        },
        {
          value: "routing", label: "إعداد الموافقات", icon: <Workflow className="h-4 w-4" />, hidden: !canConfigure,
          content: canConfigure && query.tab === "routing" ? <div className="space-y-5"><RequestRoutingClient /><details open={query.advanced === "1"} className="rounded-2xl border bg-card p-5"><summary className="cursor-pointer text-base font-bold">استثناءات الجهات — إعداد متقدم</summary><p className="my-3 text-sm text-muted-foreground">اختياري: أضف مسارًا خاصًا بمستشفى أو قسم أو فرع عند اختلافه عن القاعدة العامة. المسار الخاص له الأولوية للطلبات الجديدة.</p><ApprovalWorkflowsClient /></details></div> : null
        },
        {
          value: "outbox",
          label: "طلباتي",
          icon: <Send className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جارٍ تحميل طلباتك…</div>}><RequestWorkbenchClient mode="outbox" /></Suspense>
        }
        ]}
      />
    </div>
  );
}
