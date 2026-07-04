import { getCurrentEmployee } from "@/lib/employee/data";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { WorkflowTimeline } from "@/components/employee/WorkflowTimeline";

export default async function RequestsTracker() {
  const employee = await getCurrentEmployee();
  if (!employee) return <div>خطأ</div>;

  // Get workflows for tracking
  const workflows = await prisma.workflowInstance.findMany({
    where: { employeeId: employee.id },
    include: { steps: { orderBy: { step: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">تتبع الطلبات</h1>

      {workflows.length === 0 && (
        <div className="text-slate-500">لا توجد طلبات بعد. ابدأ بتقديم طلب من الصفحات المخصصة.</div>
      )}

      <div className="space-y-6">
        {workflows.map((wf) => {
          const currentStep = wf.steps.find(s => s.step === wf.currentStep) || wf.steps[wf.steps.length - 1];
          
          return (
            <Card key={wf.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-lg">{wf.type}</div>
                    <div className="text-xs text-slate-500">رقم الطلب: {wf.entityId}</div>
                  </div>
                  <Badge className={wf.status === "COMPLETED" ? "bg-emerald-600" : "bg-amber-500"}>
                    {wf.status === "COMPLETED" ? "مكتمل" : `المرحلة ${wf.currentStep}`}
                  </Badge>
                </div>

                <div className="mt-4">
                  <WorkflowTimeline steps={wf.steps} />
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  آخر تحديث: {wf.updatedAt.toLocaleDateString('ar-SA')}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
