import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, BriefcaseBusiness, CalendarClock, Fingerprint, ShieldCheck, UsersRound } from "lucide-react";
import { AuthPreferences } from "@/components/auth/auth-preferences";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary, Locale } from "@/lib/i18n";

export function AuthCard({
  title,
  description,
  locale,
  dictionary,
  children,
  footer
}: {
  title: string;
  description: string;
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const snapshotItems = [
    [UsersRound, dictionary.dashboard.employees, "428", "text-blue-200"],
    [CalendarClock, dictionary.dashboard.pendingLeave, "12", "text-amber-200"],
    [BriefcaseBusiness, dictionary.dashboard.openJobs, "18", "text-emerald-200"]
  ] as const;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(59,130,246,0.36),transparent_28rem),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.28),transparent_28rem),linear-gradient(135deg,#020617,#0f172a_48%,#042f2e)]" />
      <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <section className="relative grid min-h-screen lg:grid-cols-[minmax(0,1fr)_520px]">
        <div className="flex min-h-[48vh] flex-col justify-between p-6 lg:min-h-screen lg:p-10 xl:p-12">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="group flex items-center gap-3" aria-label="Lana HRMS home">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-2xl shadow-blue-950/30 transition-transform group-hover:scale-105">
                <span className="text-xl font-black tracking-tight">L</span>
              </span>
              <span>
                <span className="block text-base font-semibold tracking-tight">Lana HRMS</span>
                <span className="block text-xs text-white/60">Enterprise people cloud</span>
              </span>
            </Link>
            <AuthPreferences locale={locale} />
          </div>

          <div className="mx-auto grid w-full max-w-5xl gap-8 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-0">
            <div className="space-y-7">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/15">{dictionary.auth.heroBadge}</Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{dictionary.auth.heroTitle}</h1>
                <p className="max-w-2xl text-base leading-7 text-white/70 md:text-lg">{dictionary.auth.heroDescription}</p>
              </div>
              <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                {[["99.9%", "availability-ready"], ["RBAC", "permission-first"], ["RTL", "Arabic-ready"]].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur">
                    <p className="text-2xl font-semibold">{value}</p>
                    <p className="mt-1 text-xs text-white/60">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[520px] lg:block" aria-hidden="true">
              <div className="absolute inset-x-10 top-8 rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-blue-950/40 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{dictionary.auth.peopleAnalytics}</p>
                    <p className="text-xs text-white/55">{dictionary.auth.liveSnapshot}</p>
                  </div>
                  <BadgeCheck className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="grid gap-3">
                  {snapshotItems.map(([Icon, label, value, tone]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-950/35 p-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-white/10 p-2"><Icon className={`h-5 w-5 ${tone}`} /></span>
                        <span className="text-sm text-white/72">{label}</span>
                      </div>
                      <span className="text-2xl font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-14 left-0 w-64 rounded-[1.5rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-left-6 duration-700">
                <Fingerprint className="mb-4 h-7 w-7 text-cyan-200" />
                <p className="text-sm font-medium">{dictionary.auth.zeroTrust}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">JWT sessions, audit logs, protected workflows, and role-based navigation.</p>
              </div>
              <div className="absolute bottom-0 right-0 w-72 rounded-[1.5rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-6 duration-700">
                <div className="mb-4 h-24 rounded-2xl bg-[linear-gradient(135deg,rgba(59,130,246,.8),rgba(16,185,129,.7))]" />
                <p className="text-sm font-medium">{dictionary.auth.payrollReady}</p>
                <p className="mt-1 text-xs text-white/60">Allowances, deductions, overtime, loans, and contract data connected.</p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs text-white/50 lg:flex">
            <ShieldCheck className="h-4 w-4" /> SOC-ready controls, private uploads, and deployment documentation included.
          </div>
        </div>

        <aside className="flex items-center justify-center px-4 py-8 lg:px-8">
          <Card className="w-full max-w-md border-white/20 bg-white/80 shadow-2xl shadow-slate-950/30 backdrop-blur-2xl dark:bg-slate-950/70 dark:text-white animate-in fade-in zoom-in-95 duration-500">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  {dictionary.common.home} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
                <CardDescription className="mt-2 leading-6">{description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {children}
              {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}