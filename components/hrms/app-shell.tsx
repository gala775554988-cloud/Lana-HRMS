import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, Building2, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { hrmsNavigation } from "@/config/hrms";
import { hasPermission } from "@/lib/rbac";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/hrms/theme-toggle";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const visibleNavigation = hrmsNavigation.filter((item) => hasPermission(session.user.permissions, { action: "read", resource: item.resource }));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold" aria-label="HRMS dashboard">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Building2 className="h-5 w-5" /></span>
            <span className="hidden sm:block">Lana HRMS</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-center px-4">
            <div className="hidden max-w-xl flex-1 items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm md:flex">
              <Sparkles className="h-4 w-4 text-primary" /> Enterprise HR operations workspace
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="gap-2"><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span></Button>
            </form>
          </div>
        </div>
      </header>
      <div className="grid lg:grid-cols-[292px_1fr]">
        <aside className="border-b bg-background/80 backdrop-blur lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <div className="border-b p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-semibold">{session.user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {session.user.roles.slice(0, 3).map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto p-4 lg:block lg:space-y-1" aria-label="Primary HRMS navigation">
            <Link href="/dashboard" className="flex whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"><LayoutDashboard className="me-2 h-4 w-4" />Dashboard</Link>
            {visibleNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{item.label}</Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}