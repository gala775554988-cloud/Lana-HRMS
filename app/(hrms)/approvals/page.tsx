import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Inbox, Send, GitPullRequest, Workflow } from "lucide-react";
import { auth } from "@/auth";
import { canManageApprovalRouting } from "@/config/request-routing";
import { WorkspaceHeader } from "@/components/hrms/workspace-ui";

const RequestWorkbenchClient = dynamicImport(() => import("@/components/enterprise/request-workbench-client").then((mod) => mod.RequestWorkbenchClient));

const ApprovalWorkflowsClient = dynamicImport(() => import("@/components/enterprise/approval-workflows-client").then(mod => mod.ApprovalWorkflowsClient));
const RequestRoutingClient = dynamicImport(() => import("@/components/enterprise/request-routing-client").then(mod => mod.RequestRoutingClient));

export default async function ApprovalsPage() {
  const session = await auth();
  const canConfigure = Boolean(session?.user && canManageApprovalRouting(session.user.roles, session.user.permissions));
  return (
    <div className="space-y-5" dir="rtl">
      <WorkspaceHeader title="الطلبات والموافقات" description="متابعة الطلبات واتخاذ القرار من مكان واحد." />
      <MergedModuleTabs
        defaultValue="center"
        items={[
        {
          value: "center",
          label: "استقبال الطلبات",
          icon: <GitPullRequest className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading requests...</div>}><RequestWorkbenchClient mode="center" /></Suspense>
        },
        {
          value: "inbox",
          label: "الموافقات الواردة",
          icon: <Inbox className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading inbox...</div>}><RequestWorkbenchClient mode="inbox" /></Suspense>
        },
        {
          value: "routing", label: "مسارات الاعتماد", icon: <Workflow className="h-4 w-4" />, hidden: !canConfigure,
          content: canConfigure ? <RequestRoutingClient /> : null
        },
        {
          value: "paths", label: "مسارات الجهات", icon: <Workflow className="h-4 w-4" />, hidden: !canConfigure, content: canConfigure ? <ApprovalWorkflowsClient /> : null
        },
        {
          value: "outbox",
          label: "الموافقات الصادرة",
          icon: <Send className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading outbox...</div>}><RequestWorkbenchClient mode="outbox" /></Suspense>
        }
        ]}
      />
    </div>
  );
}
