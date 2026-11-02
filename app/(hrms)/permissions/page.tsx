import Link from "next/link";
import { Button } from "@/components/ui/button";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MergedModuleTabs } from "@/components/hrms/merged-module-tabs";
import { PermissionsAdmin } from "@/app/(hrms)/permissions-system/admin-client";
import { MultiDeviceAccessClient } from "@/components/enterprise/multi-device-access-client";
import { WorkspaceHeader } from "@/components/hrms/workspace-ui";
import { KeyRound, Shield, ShieldCheck, UserCog, Smartphone } from "lucide-react";
import { canManagePermissionAdministration } from "@/lib/enterprise/permissions-admin";
import { resolveRoleDashboard } from "@/config/auth";

export const dynamic = "force-dynamic";

const PermissionsManagementClient = dynamicImport(() =>
  import("@/components/enterprise/permissions-management-client").then((mod) => mod.PermissionsManagementClient)
);
const RolesManagementClient = dynamicImport(() =>
  import("@/components/enterprise/roles-management-client").then((mod) => mod.RolesManagementClient)
);
const SupervisorAssignmentsClient = dynamicImport(() =>
  import("@/components/enterprise/supervisor-assignments-client").then((mod) => mod.SupervisorAssignmentsClient)
);

export default async function PermissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (query.tab === "approval-workflows") redirect("/approvals?tab=routing&advanced=1");
  const activeTab = typeof query.tab === "string" && ["roles", "management", "scopes", "supervisor-assignments", "devices"].includes(query.tab) ? query.tab : "roles";
  const showAdvanced = query.advanced === "1" || ["supervisor-assignments", "devices"].includes(activeTab);
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const roles = (session.user as any).roles || [];
  const permissions = (session.user as any).permissions || [];
  if (!canManagePermissionAdministration(roles, permissions)) {
    redirect(resolveRoleDashboard(roles, Boolean((session.user as any).hasGrantedAdminAccess)));
  }

  let scopesContent: React.ReactNode = null;
  if (activeTab === "scopes") {
    const [branches, departments, hospitals] = await Promise.all([
      prisma.branch.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.department.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    scopesContent = (
      <PermissionsAdmin
        branches={JSON.parse(JSON.stringify(branches))}
        departments={JSON.parse(JSON.stringify(departments))}
        hospitals={JSON.parse(JSON.stringify(hospitals))}
      />
    );
  }

  let devicesContent: React.ReactNode = null;
  if (activeTab === "devices") {
    // This table intentionally contains only users explicitly added through
    // the device-management search control, not every employee in the HRMS.
    const managedSetting = await prisma.appSetting.findUnique({
      where: { key: "enterprise.multiDeviceManagedUsers" },
      select: { value: true }
    }).catch(() => null);
    const managedUserIds = Array.isArray(managedSetting?.value)
      ? managedSetting.value.filter((id): id is string => typeof id === "string")
      : [];
    const admins = await prisma.user.findMany({
      where: { id: { in: managedUserIds } },
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
    devicesContent = <MultiDeviceAccessClient users={users} canResetAllDevices={roles.includes("SUPER_ADMIN")} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
    <WorkspaceHeader title="الصلاحيات وإدارة الوصول" description="حدد من يستطيع استخدام النظام، وما الذي يمكنه رؤيته وتنفيذه. إعداد الموافقات متاح في قسم الطلبات فقط." actions={<Button asChild variant="outline"><Link href={showAdvanced ? "/permissions" : "/permissions?advanced=1"}>{showAdvanced ? "عرض الإعدادات الأساسية" : "إعدادات متقدمة"}</Link></Button>} />
    <MergedModuleTabs
      defaultValue="roles"
      items={[
        {
          value: "roles",
          label: "الأدوار والصلاحيات",
          icon: <ShieldCheck className="h-4 w-4" />,
          content: activeTab === "roles" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading roles...</div>}>
              <RolesManagementClient />
            </Suspense>
          ) : null
        },
        {
          value: "management",
          label: "صلاحيات المستخدمين",
          icon: <Shield className="h-4 w-4" />,
          content: activeTab === "management" ? (
            <Suspense fallback={<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading permissions...</div>}>
              <PermissionsManagementClient />
            </Suspense>
          ) : null
        },
        {
          value: "scopes",
          label: "نطاق الوصول",
          icon: <KeyRound className="h-4 w-4" />,
          content: scopesContent
        },
        {
          value: "supervisor-assignments",
          hidden: !showAdvanced,
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
          hidden: !showAdvanced,
          label: "تعدد الأجهزة",
          icon: <Smartphone className="h-4 w-4" />,
          content: devicesContent
        }
      ]}
    />
    </div>
  );
}
