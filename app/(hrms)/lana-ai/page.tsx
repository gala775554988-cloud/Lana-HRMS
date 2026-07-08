import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, LineChart, MessageSquare, Zap } from "lucide-react";

export default function LanaAIPage() {
  const actions = [
    { href: "/reports", title: "AI Analytics", icon: LineChart, desc: "افتح تقارير الوحدات لتحليل الأداء والحضور والرواتب." },
    { href: "/request-center", title: "AI Request Context", icon: MessageSquare, desc: "راجع طلبات الموظفين قبل سؤال Lana AI عن الحالات العالقة." },
    { href: "/audit-logs", title: "AI Audit Review", icon: Zap, desc: "راجع سجل التدقيق لمتابعة التغييرات التي يمكن تحليلها." },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-primary">
          <Bot className="h-8 w-8" />
          Lana AI
        </h1>
        <p className="text-muted-foreground max-w-2xl">المساعد الذكي المتكامل يعمل من زر Lana AI العائم ويستخدم بيانات النظام حسب صلاحيات المستخدم.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /> {item.title}</CardTitle>
                  <CardDescription>بيانات حية حسب الصلاحيات</CardDescription>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{item.desc}</p></CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
