import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, PieChart, ShieldCheck } from "lucide-react";

export default function DepartmentsSettingsPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="h-8 w-8 text-indigo-600" />
          إعدادات الإدارات
        </h1>
        <p className="text-muted-foreground mt-2">إدارة الهيكل التنظيمي، الميزانيات، وصلاحيات الإدارات.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              هيكل الإدارات
            </CardTitle>
            <CardDescription>إدارة تسلسل الإدارات والمدراء</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>إنشاء وتعديل الإدارات الرئيسية والفرعية</li>
              <li>تعيين مدير الإدارة ونائبه</li>
              <li>ترتيب الإدارات وعرض الهيكل الشجري</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-emerald-500" />
              الميزانية والتقارير
            </CardTitle>
            <CardDescription>إعدادات الميزانية الخاصة بكل إدارة</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>تحديد الميزانية السنوية للإدارة</li>
              <li>تخصيص ألوان الإدارات للتقارير</li>
              <li>إعدادات التقارير التلقائية</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              صلاحيات وحالة الإدارة
            </CardTitle>
            <CardDescription>تحكم بفعالية الإدارة وصلاحياتها</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>تفعيل أو إيقاف الإدارة (الحالة)</li>
              <li>الصلاحيات الافتراضية لمنسوبي الإدارة</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
