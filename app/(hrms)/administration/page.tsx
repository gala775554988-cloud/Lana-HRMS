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
