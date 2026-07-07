import dynamic from "next/dynamic";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";

const OvertimeManagementClient = dynamic(() => import("@/components/enterprise/overtime-management-client").then((mod) => mod.OvertimeManagementClient));

export default async function OvertimePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const permissions = (session.user.permissions as string[]) ?? [];
  const roles = (session.user.roles as string[]) ?? [];
  const allowed = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "manage", resource: "overtime" });
  if (!allowed) redirect("/dashboard");

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">الأوفر تايم</h1>
        <p className="mt-2 text-muted-foreground">إضافة وإدارة طلبات الأوفر تايم وتصدير المعتمد منها.</p>
      </div>
      <OvertimeManagementClient />
    </section>
  );
}
