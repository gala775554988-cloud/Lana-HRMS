'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, Building2, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeToggle } from "@/components/hrms/theme-toggle";

interface AppShellProps {
  children: ReactNode;
  companyLogo?: string | null;
}

export function AppShell({ children, companyLogo }: AppShellProps) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [dictionary, setDictionary] = useState<any>(null);
  const [locale, setLocale] = useState("en");

  // Fetch session on client
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data?.user) {
          setSession(data);
        } else {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      }
    };

    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    await signOut({ 
      redirect: true,
      callbackUrl: "/login" 
    });
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">جاري التحميل...</div>
      </div>
    );
  }

  const userRoles = (session.user?.roles as string[]) || [];
  const visibleNavigation: any[] = [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold" aria-label="HRMS dashboard">
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt="Company logo" 
                className="h-9 w-auto rounded-lg object-contain shadow-sm max-w-[140px]" 
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Building2 className="h-5 w-5" /></span>
            )}
            <span className="hidden sm:block">Lana HRMS</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-center px-4">
            <div className="hidden max-w-xl flex-1 items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm md:flex">
              <Sparkles className="h-4 w-4 text-primary" /> مساحة العمل
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher locale={locale} />
            <Button type="button" variant="outline" size="icon" aria-label="الإشعارات"><Bell className="h-4 w-4" /></Button>
            <ThemeToggle />
            <Button 
              onClick={handleLogout}
              variant="outline" 
              className="gap-2"
            >
              <LogOut className="h-4 w-4" /> 
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </Button>
          </div>
        </div>
      </header>
      <div className="grid lg:grid-cols-[292px_1fr]">
        <aside className="border-b bg-background/80 backdrop-blur lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <div className="border-b p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">مسجل الدخول كـ</p>
            <p className="truncate text-sm font-semibold">{session.user?.name ?? session.user?.email ?? session.user?.id}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {userRoles.slice(0, 3).map((role: string) => (
                <Badge key={role} variant="secondary">{role}</Badge>
              ))}
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto p-4 lg:block lg:space-y-1" aria-label="Primary HRMS navigation">
            <Link href="/" className="flex whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
              <LayoutDashboard className="me-2 h-4 w-4" />لوحة التحكم
            </Link>
            {/* Self-service link for employees */}
            <Link href="/my" className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              بوابتي الشخصية
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
