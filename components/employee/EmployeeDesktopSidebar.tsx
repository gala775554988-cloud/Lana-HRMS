'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useEmployeeNavItems } from '@/lib/employee/use-employee-nav-items';
import type { EmployeeNavItem } from '@/lib/employee/nav-items';
import { LayoutDashboard, Sparkles, ShieldCheck } from 'lucide-react';

export function EmployeeDesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { home, groups } = useEmployeeNavItems();

  const handleIntent = (href: string) => router.prefetch(href);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Check if user has administrative roles/permissions to show the top executive link
  const userRoles = (session?.user?.roles as string[]) || [];
  const isExecutiveOrManager = userRoles.some((r) => ["SUPER_ADMIN", "HR_MANAGER", "DIRECT_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "PAYROLL_OFFICER"].includes(r));

  // Separate "myData" (القسم الشخصي - بياناتي) from administrative/operational categories
  const topGroups = groups.filter((g) => g.key !== "myData");
  const myDataGroup = groups.find((g) => g.key === "myData");

  const NavLink = ({ item, emphasized = false }: { item: EmployeeNavItem; emphasized?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        prefetch={true}
        onMouseEnter={() => handleIntent(item.href)}
        onFocus={() => handleIntent(item.href)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 will-change-transform hover:-translate-y-0.5 active:scale-[0.985]',
          active
            ? 'bg-primary text-white shadow font-bold'
            : emphasized
            ? 'text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:bg-slate-900/60 dark:hover:bg-slate-800'
            : 'text-slate-600 hover:bg-primary/10 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800'
        )}
      >
        <span className="relative inline-flex shrink-0">
          <Icon className="h-4.5 w-4.5" />
          {item.badge ? (
            <span
              key={item.badge}
              className="absolute -top-1.5 -end-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-white dark:ring-slate-900 shadow-sm"
              aria-label={`${item.badge} pending approvals`}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans border-e border-primary/10 bg-gradient-to-b from-white/95 via-primary/[0.03] to-white/95 dark:from-slate-950/95 dark:via-slate-900/90 dark:to-slate-950/95 shadow-xl shadow-primary/5">
      {/* =========================================================================================
          1. الوضع الافتراضي (الإداري والعمليات): القسم الأساسي والعلوي في القائمة دائماً
          ========================================================================================= */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-5">
        <div className="flex items-center justify-between px-2 pb-2 border-b border-primary/10">
          <span className="text-xs font-black tracking-wider text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            <span>بوابة عمليات الموظف</span>
          </span>
          {isExecutiveOrManager ? (
            <Link
              href="/dashboard"
              className="text-[10px] font-black text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-xl"
              title="المرجع الأساسي لصلاحيات الإدارة"
            >
              <LayoutDashboard className="h-3 w-3" />
              <span>الإدارة العليا</span>
            </Link>
          ) : null}
        </div>

        <nav className="space-y-1">
          <NavLink item={home} emphasized />
        </nav>

        <div className="space-y-4 pt-1">
          {topGroups.map((group) => (
            <div key={group.key}>
              <p className="px-3 mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
              <nav className="space-y-1">
                {group.items.map((item) => <NavLink key={item.href} item={item} />)}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================================
          2. القسم الشخصي (أسفل القائمة): منطقة ثابتة (Fixed Footer Section) بفاصل واضح (Divider)
          مرتبطة بحساب المستخدم الحالي بحيث تظهر بياناتي الشخصية فقط دون اختلاط بالصلاحيات الإدارية
          ========================================================================================= */}
      <div className="shrink-0 border-t-2 border-primary/25 bg-gradient-to-b from-slate-50/90 via-primary/[0.03] to-white dark:from-slate-950/90 dark:to-slate-900 p-3.5 shadow-inner transition-all duration-300">
        <div className="flex items-center gap-3 mb-3 px-1 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white font-black text-xs shadow-sm ring-2 ring-primary/20">
            {session?.user?.name?.charAt(0) || "👤"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
              {session?.user?.name || "الموظف الحالي"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-extrabold text-primary truncate">حسابي الشخصي (`تظهر بياناتي أنا فقط`)</span>
            </div>
          </div>
        </div>

        <p className="px-2 mb-1.5 text-[11px] font-black uppercase tracking-wider text-primary dark:text-primary/90 flex items-center gap-1.5">
          <span>{myDataGroup?.label || "بياناتي"}</span>
          <span className="text-[9px] font-semibold text-muted-foreground">(مستقل وثابت)</span>
        </p>
        <nav className="space-y-1">
          {myDataGroup?.items.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>
      </div>
    </div>
  );
}
