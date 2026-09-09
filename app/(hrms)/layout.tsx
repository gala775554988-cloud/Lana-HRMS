import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveRoleDashboard, DEFAULT_LOGIN_REDIRECT } from "@/config/auth";
import { PERMISSION_TEMPLATES } from "@/lib/enterprise/permissions";
import { AppShell } from "@/components/hrms/app-shell";
import { TopLoader } from "@/components/ui/top-loader";
import { getRequestDictionary } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function HrmsLayout({ children }: { children: ReactNode }) {
  // Kept outside the try/catch below: next/navigation's redirect() works by
  // throwing a special NEXT_REDIRECT error that Next's own render pipeline
  // must see, not our generic diagnostic catch -- catching it here would
  // swallow the redirect and render the error box instead of navigating.
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Server-side guard mirroring app/employee/layout.tsx's inverse check: a
  // session with no admin-side role AND no admin-side permission must never
  // render the admin shell, even via direct URL entry -- it is sent to the
  // employee portal instead. This is deliberately permission-aware, not just
  // role-aware: the RBAC redesign grants permissions independent of role
  // (e.g. an ApprovalStage approver or active SupervisorAssignment gets
  // read:requests/manage:requests -- see mergeEffectivePermissions in
  // lib/enterprise/permissions.ts -- purely from being named there, with no
  // role change), and such a user legitimately needs /approvals. Blocking on
  // role alone would have locked them out of a page they actually have
  // permission for.
  const roles: string[] = (session.user as any).roles ?? [];
  const permissions: string[] = (session.user as any).permissions ?? [];
  const baseEmployeePermissions = new Set(PERMISSION_TEMPLATES.EMPLOYEE);
  const hasAdminAccess =
    resolveRoleDashboard(roles) !== DEFAULT_LOGIN_REDIRECT ||
    permissions.some((permission) => !baseEmployeePermissions.has(permission as any));
  if (!hasAdminAccess) {
    redirect(DEFAULT_LOGIN_REDIRECT);
  }

  try {
    const { locale, dictionary } = await getRequestDictionary().catch(() => ({ locale: "ar" as const, dictionary: {} as any }));

    return (
      <>
        <TopLoader />
        <AppShell locale={locale || "ar"} dictionary={dictionary || {}}>{children}</AppShell>
      </>
    );
  } catch (err: any) {
    console.error("[HrmsLayout] render failed", err);
    throw err;
  }
}
