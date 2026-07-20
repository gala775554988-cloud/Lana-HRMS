"use client";

import { ShieldAlert, Home, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { resolveRoleDashboard } from "@/config/auth";

/** Professional 403 screen shown whenever requireModulePermission (or any
 * other permission gate) throws "Forbidden" -- replaces the raw diagnostic
 * error box for this one, expected, non-bug case: the user is authenticated
 * but genuinely isn't granted this page/action. */
export function Forbidden403() {
  const { data: session } = useSession();
  const roles = (session?.user?.roles as string[]) ?? [];
  const homeHref = resolveRoleDashboard(roles);

  return (
    <section className="flex min-h-[70vh] items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">لا تملك صلاحية الوصول لهذه الصفحة</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          هذه الصفحة أو الإجراء يتطلب صلاحية غير ممنوحة لحسابك حالياً. إذا كنت تعتقد أن هذا خطأ، تواصل مع مسؤول النظام لمنحك الصلاحية المناسبة.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <a href={homeHref}><Home className="h-4 w-4" />العودة إلى لوحتي</a>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => signOut({ redirect: true, callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />تسجيل الخروج
          </Button>
        </div>
      </div>
    </section>
  );
}
