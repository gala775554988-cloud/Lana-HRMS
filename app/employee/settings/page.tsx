import { getCurrentEmployee } from "@/lib/employee/data";

export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">الإعدادات</h1>
      <div className="text-muted-foreground">إعدادات الحساب والإشعارات.</div>
    </div>
  );
}
