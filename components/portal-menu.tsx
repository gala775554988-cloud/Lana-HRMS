"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GitPullRequest, Clock, Calendar, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const portalMenuItems = [
  { title: "الرئيسية", href: "/employee/dashboard", icon: LayoutDashboard },
  { title: "الطلبات", href: "/employee/requests", icon: GitPullRequest },
  { title: "سجل الحضور", href: "/employee/attendance", icon: Clock },
  { title: "الإجازات", href: "/employee/leave", icon: Calendar },
  { title: "الوثائق والعقود", href: "/employee/documents", icon: FileText },
  { title: "الملف الشخصي", href: "/employee/profile", icon: User }
];

export function PortalMenu({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-nowrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto min-w-0", className)} dir="rtl">
      {portalMenuItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200",
              isActive
                ? "bg-white dark:bg-slate-900 text-primary dark:text-primary/50 shadow-sm border border-slate-200/80 dark:border-slate-800"
                : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
