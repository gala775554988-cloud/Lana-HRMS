import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { hrmsNavigation } from "@/config/hrms";
import { hasPermission } from "@/lib/rbac";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/hrms/theme-toggle";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const visibleNavigation = hrmsNavigation.filter((item) => hasPermission(session.user.permissions, { action: "read", resource: item.resource }));

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/dashboard" className="font-semibold">HRMS</Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={logoutAction}><Button type="submit" variant="outline">Sign out</Button></form>
          </div>
        </div>
      </header>
      <div className="grid lg:grid-cols-[280px_1fr]">
        <aside className="border-b bg-background lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <nav className="flex gap-2 overflow-x-auto p-4 lg:block lg:space-y-1">
            <Link href="/dashboard" className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">Dashboard</Link>
            {visibleNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">{item.label}</Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
