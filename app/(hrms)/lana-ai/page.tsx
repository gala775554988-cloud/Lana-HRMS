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
