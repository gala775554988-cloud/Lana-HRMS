#!/bin/bash
# Script to scaffold the Enterprise Architecture for Lana HRMS

BASE_DIR="app/(hrms)/settings"
MODULES=(
    "employees"
    "departments"
    "branches"
    "hospitals"
    "positions"
    "contracts"
    "attendance"
    "leave"
    "overtime"
    "payroll"
    "performance"
    "training"
    "assets"
    "system"
)

mkdir -p "$BASE_DIR"

# Common settings navigation component
cat << 'EOF' > "$BASE_DIR/layout.tsx"
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
EOF

for MOD in "${MODULES[@]}"; do
    mkdir -p "$BASE_DIR/$MOD"
    cat << EOF > "$BASE_DIR/$MOD/page.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ${MOD^}SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight capitalize">إعدادات ${MOD}</h1>
        <p className="text-muted-foreground">إدارة وتخصيص إعدادات ${MOD}.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الإعدادات العامة</CardTitle>
            <CardDescription>الخيارات الافتراضية</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">قريباً...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
EOF
done

# Create Lana AI Module
AI_DIR="app/(hrms)/lana-ai"
mkdir -p "$AI_DIR"
cat << 'EOF' > "$AI_DIR/page.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, LineChart, MessageSquare, Zap } from "lucide-react";

export default function LanaAIPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-primary">
          <Bot className="h-8 w-8" />
          Lana AI
        </h1>
        <p className="text-muted-foreground max-w-2xl">المساعد الذكي المتكامل لتحليل البيانات وإنشاء التقارير.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-blue-500" /> AI Chat</CardTitle>
            <CardDescription>محادثة ذكية</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">اسأل عن الموظفين والرواتب.</p></CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-emerald-500" /> AI Analytics</CardTitle>
            <CardDescription>تحليلات</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">تحليل الأداء والحضور.</p></CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> AI Automation</CardTitle>
            <CardDescription>أتمتة</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">أتمتة الردود والطلبات.</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
EOF

# Administration Module
ADMIN_DIR="app/(hrms)/administration"
mkdir -p "$ADMIN_DIR"
cat << 'EOF' > "$ADMIN_DIR/page.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Key, Activity } from "lucide-react";

export default function AdministrationPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">الإدارة والصلاحيات</h1>
        <p className="text-muted-foreground max-w-2xl">إدارة مركزية للمستخدمين والأدوار والصلاحيات.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Roles & Permissions", icon: Shield, color: "text-red-500", desc: "الأدوار والصلاحيات" },
          { title: "Users Management", icon: Users, color: "text-blue-500", desc: "إدارة المستخدمين" },
          { title: "Approval Matrix", icon: Key, color: "text-amber-500", desc: "مصفوفة الموافقات" },
          { title: "Audit & Logs", icon: Activity, color: "text-emerald-500", desc: "سجلات النظام" },
        ].map((item, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><item.icon className={`h-5 w-5 ${item.color}`} /> {item.title}</CardTitle>
            </CardHeader>
            <CardContent><CardDescription>{item.desc}</CardDescription></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
EOF

echo "Done"
