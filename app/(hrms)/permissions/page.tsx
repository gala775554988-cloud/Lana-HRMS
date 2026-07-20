import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { PermissionsAdmin } from "@/app/(hrms)/permissions-system/admin-client";
import { MultiDeviceAccessClient } from "@/components/enterprise/multi-device-access-client";
import { KeyRound, Shield, ShieldCheck, Workflow, UserCog, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

const PermissionsManagementClient = dynamicImport(() =>
  import("@/components/enterprise/permissions-management-client").then((mod) => mod.PermissionsManagementClient)
);
const RolesManagementClient = dynamicImport(() =>
  import("@/components/enterprise/roles-management-client").then((mod) => mod.RolesManagementClient)
);
const ApprovalWorkflowsClient = dynamicImport(() =>
  import("@/components/enterprise/approval-workflows-client").then((mod) => mod.ApprovalWorkflowsClient)
);
const SupervisorAssignmentsClient = dynamicImport(() =>
  import("@/components/enterprise/supervisor-assignments-client").then((mod) => mod.SupervisorAssignmentsClient)
);

export default async function PermissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "roles";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN")) redirect("/analytics");

  let scopesContent: React.ReactNode = null;
  if (activeTab === "scopes") {
    const [allRoles, branches, departments, hospitals] = await Promise.all([
      prisma.role.findMany({ orderBy: { name: "asc" } }),
      prisma.branch.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.department.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    scopesContent = (
      <PermissionsAdmin
        allRoles={JSON.parse(JSON.stringify(allRoles))}
        branches={JSON.parse(JSON.stringify(branches))}
        departments={JSON.parse(JSON.stringify(departments))}
        hospitals={JSON.parse(JSON.stringify(hospitals))}
      />
    );
  }

  let devicesContent: React.ReactNode = null;
  if (activeTab === "devices") {
    const admins = await prisma.user.findMany({
      where: { roles: { some: { role: { name: { in: ["SUPER_ADMIN", "MANAGER"] } } } } },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        canUseMultipleDevices: true,
        roles: { select: { role: { select: { name: true } } } },
        employeeProfile: { select: { employeeNumber: true, firstName: true, lastName: true } }
      },
      orderBy: { name: "asc" }
    });
    const users = admins.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      canUseMultipleDevices: u.canUseMultipleDevices,
      roleNames: Array.from(new Set(u.roles.map((r) => r.role.name))),
      employeeLabel: u.employeeProfile ? `${u.employeeProfile.firstName} ${u.employeeProfile.lastName} (${u.employeeProfile.employeeNumber})` : null
    }));
    devicesContent = <MultiDeviceAccessClient users={users} />;
  }

  return (
    <MergedModuleTabs
      defaultValue="roles"
      items={[
        {
          value: "roles",
          label: "الأدوار",
          icon: <ShieldCheck className="h-4 w-4" />,
          content: activeTab === "roles" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading roles...</div>}>
              <RolesManagementClient />
            </Suspense>
          ) : null
        },
        {
          value: "management",
          label: "صلاحيات إضافية لمستخدم",
          icon: <Shield className="h-4 w-4" />,
          content: activeTab === "management" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading permissions...</div>}>
              <PermissionsManagementClient />
            </Suspense>
          ) : null
        },
        {
          value: "scopes",
          label: "نطاقات الصلاحيات",
          icon: <KeyRound className="h-4 w-4" />,
          content: scopesContent
        },
        {
          value: "approval-workflows",
          label: "Approval Workflows",
          icon: <Workflow className="h-4 w-4" />,
          content: activeTab === "approval-workflows" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading...</div>}>
              <ApprovalWorkflowsClient />
            </Suspense>
          ) : null
        },
        {
          value: "supervisor-assignments",
          label: "تكليفات المشرفين",
          icon: <UserCog className="h-4 w-4" />,
          content: activeTab === "supervisor-assignments" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading...</div>}>
              <SupervisorAssignmentsClient />
            </Suspense>
          ) : null
        },
        {
          value: "devices",
          label: "تعدد الأجهزة",
          icon: <Smartphone className="h-4 w-4" />,
          content: devicesContent
        }
      ]}
    />
  );
}
