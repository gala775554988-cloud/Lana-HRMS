import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { prisma } from "@/lib/prisma";

export default async function LeaveHistory() {
  const employee = await getCurrentEmployeeCached();
  const leaves = await prisma.leaveRequest.findMany({
    where: { employeeId: employee?.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h2 className="font-semibold mb-4">سجل الإجازات</h2>
      <div className="space-y-3">
        {leaves.map(l => (
          <div key={l.id} className="p-4 border rounded-2xl flex justify-between">
            <div>{l.startDate.toLocaleDateString()} - {l.endDate.toLocaleDateString()}</div>
            <div className="text-sm">{l.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
