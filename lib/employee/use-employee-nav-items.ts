"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { GitPullRequest } from "lucide-react";
import { EMPLOYEE_NAV_ITEMS, type EmployeeNavItem } from "@/lib/employee/nav-items";
import { usePendingApprovalsCount } from "@/lib/hooks/use-pending-approvals-count";

/**
 * The employee self-service portal (EmployeeDesktopSidebar/EmployeeMobileSidebar)
 * has its own fixed nav list, completely separate from the HRMS admin shell's
 * navItems in app-shell.tsx -- EMPLOYEE-role users are always routed to this
 * portal (see resolveRoleDashboard), so a plain employee named as a
 * CUSTOM_APPROVER in a workflow path (see lib/enterprise/workflow-paths.ts)
 * would never see the "Pending Approvals" entry that only exists in the HRMS
 * shell. This hook appends that entry here too, gated on the same
 * read:requests/manage:requests permission, so it shows up wherever the user
 * actually lives.
 */
export function useEmployeeNavItems(): EmployeeNavItem[] {
  const { data: session, status } = useSession();
  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canSeeApprovals = permissions.includes("read:requests") || permissions.includes("manage:requests");
  const { data: pendingApprovalsCount } = usePendingApprovalsCount(status === "authenticated" && canSeeApprovals);

  return useMemo(() => {
    if (!canSeeApprovals) return EMPLOYEE_NAV_ITEMS;
    return [
      ...EMPLOYEE_NAV_ITEMS,
      { href: "/approvals", label: "طلبات بانتظار الموافقة", icon: GitPullRequest, badge: pendingApprovalsCount || undefined }
    ];
  }, [canSeeApprovals, pendingApprovalsCount]);
}
