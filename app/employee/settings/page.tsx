import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const settings = [
  { href: "/employee/settings/account", title: "الحساب", description: "بيانات الحساب والملف الوظيفي المرتبط." },
  { href: "/employee/settings/language", title: "اللغة والمنطقة الزمنية", description: "حفظ اللغة والمنطقة الزمنية في تفضيلات الموظف." },
  { href: "/employee/settings/notifications", title: "الإشعارات", description: "إدارة تفضيلات تنبيهات النظام." },
  { href: "/employee/settings/password", title: "كلمة المرور", description: "تحديث كلمة المرور بطريقة آمنة." },
  { href: "/employee/settings/profile-picture", title: "الصورة الشخصية", description: "رفع أو تحديث صورة الملف الشخصي." },
  { href: "/employee/settings/theme", title: "الثيم", description: "تطبيق الثيم وحفظه في التفضيلات." },
];

export default async function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الإعدادات</h1>
        <p className="text-muted-foreground mt-2">إعدادات الحساب والإشعارات والمظهر.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settings.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader><CardTitle>{item.title}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{item.description}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
