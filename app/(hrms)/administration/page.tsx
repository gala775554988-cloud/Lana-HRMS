import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Key, Activity, Server } from "lucide-react";

export default function AdministrationPage() {
  const items = [
    { title: "Roles & Permissions", icon: Shield, color: "text-red-500", desc: "الأدوار والصلاحيات", href: "/permissions-management" },
    { title: "Users Management", icon: Users, color: "text-blue-500", desc: "إدارة المستخدمين", href: "/permissions-management" },
    { title: "Approval Matrix", icon: Key, color: "text-amber-500", desc: "مصفوفة الموافقات", href: "/approvals-inbox" },
    { title: "Audit & Logs", icon: Activity, color: "text-emerald-500", desc: "سجلات النظام", href: "/audit-logs" },
    { title: "System Status", icon: Server, color: "text-indigo-500", desc: "حالة النظام والفحص والإصلاح", href: "/administration/system-status" },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">الإدارة والصلاحيات</h1>
        <p className="text-muted-foreground max-w-2xl">إدارة مركزية للمستخدمين والأدوار والصلاحيات وحالة النظام.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className="block">
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Icon className={`h-5 w-5 ${item.color}`} /> {item.title}</CardTitle>
                </CardHeader>
                <CardContent><CardDescription>{item.desc}</CardDescription></CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
