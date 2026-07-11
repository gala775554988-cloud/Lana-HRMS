import dynamic from "next/dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const OrganizationHierarchyClient = dynamic(() => import("@/components/enterprise/organization-hierarchy-client").then((mod) => mod.OrganizationHierarchyClient));

export default async function OrganizationHierarchyPage() {
  const session = await auth();
  const roles = (session?.user?.roles as string[]) ?? [];
  if (!session?.user) redirect("/login");
  if (!roles.includes("SUPER_ADMIN")) redirect("/employees");

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Organization</p>
        <h1 className="text-3xl font-semibold tracking-tight">Organization Hierarchy</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Manage company hierarchy, managers, branches, departments, sections, and projects without changing employee records.</p>
      </div>
      <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading hierarchy...</div>}>
        <OrganizationHierarchyClient />
      </Suspense>
    </section>
  );
}
