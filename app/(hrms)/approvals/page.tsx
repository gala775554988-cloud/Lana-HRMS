import { redirect } from "next/navigation";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Inbox, Send, GitPullRequest, Workflow } from "lucide-react";
import { auth } from "@/auth";
import { canManageApprovalRouting } from "@/config/request-routing";

const RequestWorkbenchClient = dynamicImport(() => import("@/components/enterprise/request-workbench-client").then((mod) => mod.RequestWorkbenchClient));

const ApprovalWorkflowsClient = dynamicImport(() => import("@/components/enterprise/approval-workflows-client").then(mod => mod.ApprovalWorkflowsClient));
const RequestRoutingClient = dynamicImport(() => import("@/components/enterprise/request-routing-client").then(mod => mod.RequestRoutingClient));

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (query.tab === "paths") redirect("/approvals?tab=routing&advanced=1");
  const session = await auth();
  const canConfigure = Boolean(session?.user && canManageApprovalRouting(session.user.roles, session.user.permissions));
  return (
    <div className="space-y-5" dir="rtl">
      <header className="lana-workspace-hero rounded-3xl p-6 sm:p-9">
        <p className="text-sm font-semibold text-indigo-200">مساحة المسؤول في Lana</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">الطلبات والموافقات</h1>
        <p className="mt-3 text-sm text-slate-200">راجع الطلبات الموكلة إليك، واتخذ القرار، وتابع سجل الموافقات.</p>
      </header>
      <MergedModuleTabs
        defaultValue="center"
        items={[
        {
          value: "center",
          label: "جميع الطلبات والكشوف",
          icon: <GitPullRequest className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">جارٍ تحميل الطلبات…</div>}><RequestWorkbenchClient mode="center" /></Suspense>
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
