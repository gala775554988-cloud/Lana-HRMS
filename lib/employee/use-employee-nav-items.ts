"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { GitPullRequest } from "lucide-react";
import { EMPLOYEE_HOME_ITEM, EMPLOYEE_NAV_GROUPS, type EmployeeNavGroup } from "@/lib/employee/nav-items";
import { usePendingApprovalsCount } from "@/lib/hooks/use-pending-approvals-count";

/**
 * The employee self-service portal (EmployeeDesktopSidebar/EmployeeMobileSidebar)
 * has its own fixed nav list, completely separate from the HRMS admin shell's
 * navItems in app-shell.tsx -- EMPLOYEE-role users are always routed to this
 * portal (see resolveRoleDashboard), so a plain employee named as a
 * approver on an ApprovalStage (see lib/enterprise/approval-engine.ts)
 * would never see the "Pending Approvals" entry that only exists in the HRMS
 * shell. This hook appends that entry to the "الطلبات" group here too, gated
 * on the same read:requests/manage:requests permission, so it shows up
 * wherever the user actually lives.
 */
export function useEmployeeNavItems(): { home: typeof EMPLOYEE_HOME_ITEM; groups: EmployeeNavGroup[] } {
  const { data: session, status } = useSession();
  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canSeeApprovals = permissions.includes("read:requests") || permissions.includes("manage:requests");
  const { data: pendingApprovalsCount } = usePendingApprovalsCount(status === "authenticated" && canSeeApprovals);

  const groups = useMemo(() => {
    if (!canSeeApprovals) return EMPLOYEE_NAV_GROUPS;
    return EMPLOYEE_NAV_GROUPS.map((group) =>
      group.key === "requests"
        ? { ...group, items: [...group.items, { href: "/approvals", label: "طلبات بانتظار الموافقة", icon: GitPullRequest, badge: pendingApprovalsCount || undefined }] }
        : group
    );
  }, [canSeeApprovals, pendingApprovalsCount]);

  return { home: EMPLOYEE_HOME_ITEM, groups };
}
