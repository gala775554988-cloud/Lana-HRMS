import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Tracker({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const employee = await getCurrentEmployeeCached();
  const query = await searchParams;
  const highlight = typeof query.highlight === "string" ? query.highlight : null;

  const workflows = await prisma.workflowInstance.findMany({
    where: { employeeId: employee?.id },
    include: { steps: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">تتبع الطلبات (Workflow)</h1>

      {workflows.length === 0 && <div className="text-slate-500">لا يوجد طلبات حالياً</div>}

      {workflows.map(wf => (
        <div key={wf.id} id={`wf-${wf.id}`} className={`mb-8 border rounded-3xl p-6 ${wf.id === highlight ? "ring-2 ring-primary" : ""}`}>
          <div className="flex justify-between">
            <div>
              <div className="font-semibold">{wf.type}</div>
              <div className="text-xs text-slate-500">المرحلة الحالية: {wf.currentStep}/3</div>
            </div>
            <div className={`text-xs px-3 py-1 rounded-full ${wf.status === "COMPLETED" ? "bg-emerald-100" : "bg-amber-100"}`}>
              {wf.status}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {wf.steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <div className={`h-2 w-2 rounded-full ${step.status === "APPROVED" ? "bg-emerald-500" : "bg-slate-300"}`} />
                <div>المرحلة {step.step}</div>
                <div className="text-slate-500 flex-1">— {step.status}</div>
                {step.approvedAt && <div className="text-xs text-emerald-600">{step.approvedAt.toLocaleDateString()}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
