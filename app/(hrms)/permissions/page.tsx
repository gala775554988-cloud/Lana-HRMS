import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { PermissionsAdmin } from "@/app/(hrms)/permissions-system/admin-client";
import { WorkflowPathsTabs } from "@/components/enterprise/workflow-paths-tabs";
import { MultiDeviceAccessClient } from "@/components/enterprise/multi-device-access-client";
import { KeyRound, Shield, Workflow, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

const PermissionsManagementClient = dynamicImport(() =>
  import("@/components/enterprise/permissions-management-client").then((mod) => mod.PermissionsManagementClient)
);

export default async function PermissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const activeTab = typeof query.tab === "string" ? query.tab : "management";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user as any).roles || [];
  if (!roles.includes("SUPER_ADMIN")) redirect("/analytics");

  let scopesContent: React.ReactNode = null;
  if (activeTab === "scopes") {
    const [allRoles, branches, departments, hospitals, approvalChains] = await Promise.all([
      prisma.role.findMany({ orderBy: { name: "asc" } }),
      prisma.branch.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.department.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      Promise.all(["leave", "overtime", "loan", "expense"].map(async (m) => ({
        module: m,
        chain: await prisma.hrApprovalChain.findMany({ where: { module: m, isActive: true }, orderBy: { level: "asc" } }),
      }))),
    ]);
    scopesContent = (
      <PermissionsAdmin
        allRoles={JSON.parse(JSON.stringify(allRoles))}
        branches={JSON.parse(JSON.stringify(branches))}
        departments={JSON.parse(JSON.stringify(departments))}
        hospitals={JSON.parse(JSON.stringify(hospitals))}
        approvalChains={JSON.parse(JSON.stringify(approvalChains))}
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
      defaultValue="management"
      items={[
        {
          value: "management",
          label: "إدارة الصلاحيات",
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
          value: "workflow-paths",
          label: "محرر مسارات الموافقات",
          icon: <Workflow className="h-4 w-4" />,
          content: activeTab === "workflow-paths" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">اضبط سلسلة الاعتماد لكل مسار؛ يتم حفظ كل مسار كاملاً عند الضغط على "حفظ".</p>
              <WorkflowPathsTabs />
            </div>
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
