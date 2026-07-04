import { getCurrentEmployee } from "@/lib/employee/data";
import { Card, CardContent } from "@/components/ui/card";

export default async function AccountSettings() {
  const employee = await getCurrentEmployee();

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4 text-sm">
          <div><strong>الاسم:</strong> {employee?.firstName} {employee?.lastName}</div>
          <div><strong>رقم الموظف:</strong> {employee?.employeeNumber}</div>
          <div><strong>الهوية:</strong> {employee?.nationalId}</div>
          <div><strong>القسم:</strong> {employee?.department?.name}</div>
          <div><strong>البريد:</strong> {employee?.email}</div>
        </CardContent>
      </Card>
    </div>
  );
}
