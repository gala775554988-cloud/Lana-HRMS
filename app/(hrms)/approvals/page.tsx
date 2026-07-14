import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { Inbox, Send, GitPullRequest } from "lucide-react";

const RequestWorkbenchClient = dynamicImport(() => import("@/components/enterprise/request-workbench-client").then((mod) => mod.RequestWorkbenchClient));

export default function ApprovalsPage() {
  return (
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
          value: "outbox",
          label: "الموافقات الصادرة",
          icon: <Send className="h-4 w-4" />,
          content: <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading outbox...</div>}><RequestWorkbenchClient mode="outbox" /></Suspense>
        }
      ]}
    />
  );
}
