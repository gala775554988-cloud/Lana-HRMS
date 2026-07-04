import { getCurrentEmployee } from "@/lib/employee/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ExpensesPage() {
  const employee = await getCurrentEmployee();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">المصروفات</h1>
        <p className="text-slate-500">إدارة طلبات المصروفات</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>طلب مصروفات جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">قدم طلب مصروفات جديد. سيتم مراجعته من قبل الإدارة.</p>
          <Button>تقديم طلب مصروفات</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المصروفات السابقة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500">لا توجد مصروفات مسجلة بعد.</div>
        </CardContent>
      </Card>
    </div>
  );
}
