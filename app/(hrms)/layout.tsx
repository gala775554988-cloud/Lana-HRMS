import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveRoleDashboard, DEFAULT_LOGIN_REDIRECT } from "@/config/auth";
import { PERMISSION_TEMPLATES } from "@/lib/enterprise/permissions";
import { AppShell } from "@/components/hrms/app-shell";
import { getCompanyLogo } from "@/lib/settings";
import { TopLoader } from "@/components/ui/top-loader";
import { getRequestDictionary } from "@/lib/i18n-server";
import { AlertTriangle } from "lucide-react";
import "@/lib/error-interceptor";

export const dynamic = "force-dynamic";

function DiagnosticConfessionBox({ err, location }: { err: any; location: string }) {
  const errMsg = err?.message || String(err || "Unknown error");
  const stack = err?.stack || "";
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-slate-900 text-rose-100" dir="rtl">
      <div className="max-w-2xl w-full rounded-3xl border border-rose-500/50 bg-rose-950/90 p-6 shadow-2xl">
        <h2 className="text-lg font-black text-rose-300">اعتراف النظام بالخطأ التقني المباشر (`{location}`)</h2>
        <p className="font-mono text-xs p-3 bg-black/60 rounded-xl mt-3 text-rose-400 font-bold select-all">{errMsg}</p>
        {stack ? <pre className="font-mono text-[10px] p-3 bg-black/80 text-slate-300 rounded-xl mt-3 overflow-auto max-h-64 select-all">{stack}</pre> : null}
      </div>
    </div>
  );
}

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
    const [logo, { locale, dictionary }] = await Promise.all([
      getCompanyLogo().catch(() => null),
      getRequestDictionary().catch(() => ({ locale: "ar" as const, dictionary: {} as any }))
    ]);

    return (
      <>
        <TopLoader />
        <AppShell companyLogo={logo} locale={locale || "ar"} dictionary={dictionary || {}}>{children}</AppShell>
      </>
    );
  } catch (err: any) {
    return <DiagnosticConfessionBox err={err} location="HrmsLayout (/app/(hrms)/layout)" />;
  }
}
