"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, List, BarChart3, Settings } from "lucide-react";

export function ModuleTabs({ module }: { module: string }) {
  const pathname = usePathname();
  
  const tabs = [
    { name: "لوحة التحكم", href: `/${module}/dashboard`, icon: LayoutDashboard },
    { name: "القائمة", href: `/${module}`, icon: List, exact: true },
    { name: "التقارير", href: `/${module}/reports`, icon: BarChart3 },
    { name: "الإعدادات", href: `/${module}/settings`, icon: Settings },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-px mb-6 px-1">
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors hover:text-primary",
              isActive 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:border-muted"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
