import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmployeeSelfService } from "@/components/hrms/employee-self-service";

export default async function MyEmployeePortal() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8 text-center">يرجى تسجيل الدخول</div>;
  }

  // Get the logged-in employee's full profile
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    include: {
      department: true,
      position: true,
      branch: true,
    },
  });

  // Latest payroll for salary display (read-only)
  let salaryInfo = null;
  if (employee) {
    const latestPayroll = await prisma.payrollItem.findFirst({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
    });

    if (latestPayroll) {
      salaryInfo = {
        baseSalary: Number(latestPayroll.baseSalary),
        currency: latestPayroll.currency || "SAR",
      };
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <EmployeeSelfService
        employee={employee}
        salaryInfo={salaryInfo}
        userName={session.user.name}
      />
    </div>
  );
}
