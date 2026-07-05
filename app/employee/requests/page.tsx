import { getCurrentEmployee } from "@/lib/employee/data";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function EmployeeRequests() {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return (
      <div className="p-8 text-center">
        <p>لم يتم العثور على بيانات الموظف</p>
      </div>
    );
  }

  // Fetch real requests from existing tables
  let leaveRequests: any[] = [];
  let overtimeRequests: any[] = [];
  let loanRequests: any[] = [];

  try {
    [leaveRequests, overtimeRequests, loanRequests] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { leaveType: true }
      }).catch(() => []),
      prisma.overtimeRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: "desc" },
        take: 10
      }).catch(() => []),
      prisma.loan.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: "desc" },
        take: 10
      }).catch(() => []),
    ]);
  } catch (error) {
    console.error("Error fetching requests:", error);
  }

  const allRequests = [
    ...leaveRequests.map(r => ({
      id: r.id,
      type: "إجازة",
      status: r.status,
      date: r.createdAt,
      details: r.leaveType?.name || "إجازة"
    })),
    ...overtimeRequests.map(r => ({
      id: r.id,
      type: "ساعات إضافية",
      status: r.status,
      date: r.createdAt,
      details: `${r.hours} ساعات`
    })),
    ...loanRequests.map(r => ({
      id: r.id,
      type: "سلفة",
      status: r.status,
      date: r.createdAt,
      details: `${r.principalAmount} ${r.currency || 'SAR'}`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">طلباتي</h1>
        <Link 
          href="/employee/leave/new" 
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700"
        >
          طلب جديد
        </Link>
      </div>

      {allRequests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">لا توجد طلبات بعد</h3>
            <p className="text-slate-500 mb-6">ابدأ بتقديم طلب إجازة أو ساعات إضافية أو سلفة</p>
            <div className="flex gap-3 justify-center">
              <Link href="/employee/leave/new" className="px-4 py-2 bg-white border rounded-xl text-sm">طلب إجازة</Link>
              <Link href="/employee/requests" className="px-4 py-2 bg-white border rounded-xl text-sm">طلب سلفة</Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {allRequests.map((req, index) => (
            <Card key={`${req.type}-${index}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-lg">{req.type}</div>
                    <div className="text-sm text-slate-600 mt-1">{req.details}</div>
                  </div>
                  <Badge 
                    className={
                      req.status === "APPROVED" || req.status === "COMPLETED" 
                        ? "bg-emerald-100 text-emerald-700" 
                        : req.status === "PENDING" 
                        ? "bg-amber-100 text-amber-700" 
                        : "bg-rose-100 text-rose-700"
                    }
                  >
                    {req.status}
                  </Badge>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {new Date(req.date).toLocaleDateString('ar-SA')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
