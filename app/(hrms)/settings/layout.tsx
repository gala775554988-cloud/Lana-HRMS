import { ReactNode } from "react";
import Link from "next/link";
import { Settings, Users, Building, MapPin, Stethoscope, Briefcase, FileSignature, Clock, CalendarDays, Timer, Wallet, LineChart, GraduationCap, Laptop, Shield, Cpu } from "lucide-react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const navItems = [
    { name: "إعدادات الموظفين", href: "/settings/employees", icon: Users },
    { name: "إعدادات الإدارات", href: "/settings/departments", icon: Building },
    { name: "إعدادات الفروع", href: "/settings/branches", icon: MapPin },
    { name: "إعدادات المستشفيات", href: "/settings/hospitals", icon: Stethoscope },
    { name: "إعدادات المناصب", href: "/settings/positions", icon: Briefcase },
    { name: "إعدادات العقود", href: "/settings/contracts", icon: FileSignature },
    { name: "إعدادات الحضور", href: "/settings/attendance", icon: Clock },
    { name: "إعدادات الإجازات", href: "/settings/leave", icon: CalendarDays },
    { name: "إعدادات الأوفر تايم", href: "/settings/overtime", icon: Timer },
    { name: "إعدادات الرواتب", href: "/settings/payroll", icon: Wallet },
    { name: "إعدادات الأداء", href: "/settings/performance", icon: LineChart },
    { name: "إعدادات التدريب", href: "/settings/training", icon: GraduationCap },
    { name: "إعدادات الأصول", href: "/settings/assets", icon: Laptop },
    { name: "الإدارة والصلاحيات", href: "/administration", icon: Shield },
    { name: "إعدادات النظام", href: "/settings/system", icon: Settings },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      <aside className="w-full lg:w-64 flex-shrink-0">
        <nav className="flex flex-col gap-1 rounded-xl border bg-card p-3 shadow-sm">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            إعدادات النظام
          </div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-foreground transition-colors">
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 rounded-xl border bg-card p-6 shadow-sm min-h-[500px]">
        {children}
      </main>
    </div>
  );
}
