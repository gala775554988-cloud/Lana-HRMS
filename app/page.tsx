import Link from "next/link";
import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { HeroMiddleExperience } from "@/components/marketing/hero-demo";
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,106,248,0.20),transparent_34rem),radial-gradient(circle_at_20%_70%,rgba(46,42,140,0.13),transparent_30rem),linear-gradient(135deg,rgba(8,27,70,0.04),rgba(255,255,255,0.12))]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <BrandLogo href="/" size="md" subtitle="Human Resource Management" subtitleClassName="text-[#6B7280]" />
        <div className="flex items-center gap-3">
          <ClientLanguageToggle variant="outline" />
          <Button asChild className="rounded-2xl bg-[#2E2A8C] px-5 text-white shadow-lg shadow-[#2E2A8C]/20 hover:bg-[#24206f]">
            <Link href="/login">ابدأ الآن</Link>
          </Button>
        </div>
      </header>

      <HeroMiddleExperience />

      <footer className="relative z-10 border-t border-[#E5E7EB] bg-white/70 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-[#6B7280] sm:flex-row sm:items-center sm:justify-between">
          <p>Powered by Lana Medical</p>
          <p>Version 1.0 • Build 2026.07 • © {new Date().getFullYear()} Lana HRMS</p>
        </div>
      </footer>
    </main>
  );
}
