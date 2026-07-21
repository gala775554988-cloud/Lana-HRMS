"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { GitPullRequest } from "lucide-react";
import { EMPLOYEE_HOME_ITEM, EMPLOYEE_NAV_GROUPS, type EmployeeNavGroup } from "@/lib/employee/nav-items";
import { usePendingApprovalsCount } from "@/lib/hooks/use-pending-approvals-count";

// Roles that administer/approve on behalf of others -- membership in any of
// these is enough on its own to show the entry, independent of whether they
// currently have anything pending.
const ADMIN_APPROVAL_ROLES = ["SUPER_ADMIN", "HR_MANAGER", "BRANCH_MANAGER", "DEPARTMENT_MANAGER", "SUPERVISOR", "REQUESTS_OFFICER", "PROJECT_MANAGER"];

/**
 * The employee self-service portal (EmployeeDesktopSidebar/EmployeeMobileSidebar)
 * has its own fixed nav list, completely separate from the HRMS admin shell's
 * navItems in app-shell.tsx -- EMPLOYEE-role users are always routed to this
 * portal (see resolveRoleDashboard), so a plain employee named as a
 * approver on an ApprovalStage (see lib/enterprise/approval-engine.ts)
 * would never see the "Pending Approvals" entry that only exists in the HRMS
 * shell. This hook appends that entry to the "الطلبات" group here too.
 *
 * Visibility is intentionally NOT based on the read:requests/manage:requests
 * permission strings: those can be broadly granted at the role level (via
 * the Role/Permission admin UI) for reasons unrelated to this one nav item,
 * which would leak "who's waiting on approval" to plain employees. Instead
 * this checks two hard, unspoofable signals: an actual administrative/
 * managerial role, or a genuinely non-zero live pending-approvals count
 * (the count query itself filters to `approverUserId: session.user.id`, so a
 * non-zero result only ever happens for someone truly named as an approver
 * somewhere -- see app/api/enterprise/requests/pending-count/route.ts).
 */
export function useEmployeeNavItems(): { home: typeof EMPLOYEE_HOME_ITEM; groups: EmployeeNavGroup[] } {
  const { data: session, status } = useSession();
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  const hasAdminApprovalRole = roles.some((role) => ADMIN_APPROVAL_ROLES.includes(role));
  const { data: pendingApprovalsCount } = usePendingApprovalsCount(status === "authenticated");
  const canSeeApprovals = hasAdminApprovalRole || (pendingApprovalsCount ?? 0) > 0;

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
