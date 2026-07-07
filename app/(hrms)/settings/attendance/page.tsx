import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AttendanceSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight capitalize">إعدادات attendance</h1>
        <p className="text-muted-foreground">إدارة وتخصيص إعدادات attendance.</p>
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
