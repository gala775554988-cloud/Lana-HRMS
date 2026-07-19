import type { ReactNode } from "react";
import { AppShell } from "@/components/hrms/app-shell";
import { getCompanyLogo } from "@/lib/settings";
import { TopLoader } from "@/components/ui/top-loader";
import { getRequestDictionary } from "@/lib/i18n-server";
import { AlertTriangle } from "lucide-react";

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
