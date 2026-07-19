import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatAmount(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber().toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Number(value ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ExpensesPage() {
  const employee = await getCurrentEmployeeCached();
  const expenses = employee
    ? await prisma.expenseRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">المصروفات</h1>
          <p className="text-slate-500">إدارة طلبات المصروفات المسجلة باسمك</p>
        </div>
        <Button asChild>
          <Link href="/employee/expenses/new">تقديم طلب مصروفات</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المصروفات السابقة</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-sm text-slate-500">لا توجد مصروفات مسجلة بعد.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                    <th className="px-4 py-3 text-right font-medium">الفئة</th>
                    <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">الوصف</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="px-4 py-3">{expense.createdAt.toLocaleDateString("ar-SA")}</td>
                      <td className="px-4 py-3">{expense.category}</td>
                      <td className="px-4 py-3">{formatAmount(expense.amount)} ر.س</td>
                      <td className="px-4 py-3">{expense.status}</td>
                      <td className="px-4 py-3">{expense.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
