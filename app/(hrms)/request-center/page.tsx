import dynamic from "next/dynamic";
import { Suspense } from "react";
const RequestWorkbenchClient = dynamic(() => import("@/components/enterprise/request-workbench-client").then((mod) => mod.RequestWorkbenchClient));
export default function RequestCenterPage() {
  return <section className="space-y-6"><div className="rounded-2xl border bg-background p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Approvals</p><h1 className="text-3xl font-semibold tracking-tight">Request Center</h1><p className="mt-2 text-muted-foreground">Review pending, approved, rejected, returned, and archived requests within your authorized scope.</p></div><Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading requests...</div>}><RequestWorkbenchClient mode="center" /></Suspense></section>;
}
