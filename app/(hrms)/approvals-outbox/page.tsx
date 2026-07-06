import dynamic from "next/dynamic";
import { Suspense } from "react";
const RequestWorkbenchClient = dynamic(() => import("@/components/enterprise/request-workbench-client").then((mod) => mod.RequestWorkbenchClient));
export default function ApprovalsOutboxPage() {
  return <section className="space-y-6"><div className="rounded-2xl border bg-background p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Outbox</p><h1 className="text-3xl font-semibold tracking-tight">Approvals Outbox</h1><p className="mt-2 text-muted-foreground">Requests that you have already processed.</p></div><Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading outbox...</div>}><RequestWorkbenchClient mode="outbox" /></Suspense></section>;
}
