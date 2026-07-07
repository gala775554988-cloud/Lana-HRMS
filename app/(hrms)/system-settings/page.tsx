import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <Settings className="h-8 w-8" />
          إعدادات النظام العامة
        </h1>
        <p className="text-muted-foreground mt-2">بيانات الشركة، الشعار، ألوان النظام والثيم.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>بيانات الشركة</CardTitle>
            <CardDescription>الاسم، الشعار، وسجلات الشركة.</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">قريباً...</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
