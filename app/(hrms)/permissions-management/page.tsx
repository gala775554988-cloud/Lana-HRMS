import dynamic from "next/dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const PermissionsManagementClient = dynamic(() =>
  import("@/components/enterprise/permissions-management-client").then((mod) => mod.PermissionsManagementClient)
);

export default async function PermissionsManagementPage() {
  const session = await auth();
  const roles = (session?.user?.roles as string[]) ?? [];
  if (!session?.user) redirect("/login");
  if (!roles.includes("SUPER_ADMIN")) redirect("/employees");

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Administration</p>
        <h1 className="text-3xl font-semibold tracking-tight">Permissions Management</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Manage direct user permissions independently from roles, apply templates, and audit every change.
        </p>
      </div>
      <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading permissions...</div>}>
        <PermissionsManagementClient />
      </Suspense>
    </section>
  );
}
