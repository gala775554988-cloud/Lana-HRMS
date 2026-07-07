import Link from "next/link";
import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { HeroDemoPhone } from "@/components/marketing/hero-demo";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    const isAdmin = roles.some((role: string) =>
      ["SUPER_ADMIN", "HR_MANAGER", "PAYROLL_MANAGER", "RECRUITER", "MANAGER"].includes(role)
    );

    redirect(isAdmin ? "/dashboard" : "/employee/dashboard");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#F5F7FB] text-[#111827]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,106,248,0.18),transparent_34rem),radial-gradient(circle_at_20%_70%,rgba(46,42,140,0.12),transparent_30rem)]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <BrandLogo href="/" size="md" subtitle="Human Resource Management" subtitleClassName="text-[#6B7280]" />
        <div className="flex items-center gap-3">
          <ClientLanguageToggle variant="outline" />
          <Button asChild className="rounded-2xl bg-[#2E2A8C] px-5 text-white shadow-lg shadow-[#2E2A8C]/20 hover:bg-[#24206f]">
            <Link href="/login">ابدأ الآن</Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] max-w-7xl items-center gap-12 px-6 pb-12 pt-4 lg:grid-cols-[1fr_0.85fr] lg:px-8">
        <div className="order-2 space-y-8 text-right lg:order-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white/80 px-4 py-2 text-sm font-semibold text-[#2E2A8C] shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            Enterprise HRMS powered by Lana Medical
          </div>
          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-[#111827] md:text-7xl">
              Lana HRMS
              <span className="block bg-gradient-to-l from-[#2E2A8C] via-[#4B46C6] to-[#6D6AF8] bg-clip-text text-transparent">
                منظومة موارد بشرية ذكية
              </span>
            </h1>
            <p className="max-w-2xl text-lg leading-9 text-[#6B7280] md:text-xl">
              منصة موحدة لإدارة الموظفين، الحضور، الرواتب، الإجازات، المستشفيات، العقود، الأوفر تايم، وسير الموافقات بتجربة حديثة آمنة وسريعة.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button asChild size="lg" className="rounded-2xl bg-[#2E2A8C] px-8 py-6 text-base font-bold text-white shadow-xl shadow-[#2E2A8C]/25 hover:bg-[#24206f]">
              <Link href="/login">ابدأ الآن</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-2xl border-[#E5E7EB] bg-white/80 px-8 py-6 text-base font-bold text-[#2E2A8C] shadow-sm hover:bg-white">
              <Link href="/login?admin=true">عرض النظام</Link>
            </Button>
          </div>
          <div className="grid max-w-2xl grid-cols-3 gap-3 text-center sm:text-right">
            {[
              ["5000+", "استيراد جماعي"],
              ["RBAC", "صلاحيات دقيقة"],
              ["PWA", "تثبيت على الجوال"]
            ].map(([value, label]) => (
              <div key={label} className="rounded-3xl border border-[#E5E7EB] bg-white/80 p-4 shadow-sm backdrop-blur">
                <p className="text-2xl font-black text-[#2E2A8C]">{value}</p>
                <p className="mt-1 text-xs font-semibold text-[#6B7280]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-2">
          <HeroDemoPhone />
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#E5E7EB] bg-white/70 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-[#6B7280] sm:flex-row sm:items-center sm:justify-between">
          <p>Powered by Lana Medical</p>
          <p>Version 1.0 • Build 2026.07 • © {new Date().getFullYear()} Lana HRMS</p>
        </div>
      </footer>
    </main>
  );
}
