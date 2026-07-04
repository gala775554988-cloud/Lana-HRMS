import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmployeePortal } from "@/components/hrms/employee-portal";

export default async function MyEmployeePortal() {
  const session = await auth();
  
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[#0A0A12] flex items-center justify-center text-white">
        يرجى تسجيل الدخول
      </div>
    );
  }

  // Fetch full employee profile
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

  // If no employee profile yet, create a minimal fallback (helps with demo login)
  const employeeData = employee || {
    id: "demo-" + session.user.id,
    firstName: session.user.name?.split(" ")[0] || "موظف",
    lastName: session.user.name?.split(" ").slice(1).join(" ") || "",
    employeeNumber: "EMP-" + (session.user.id.slice(0, 5) || "001"),
    nationalId: "1000000001",
    profilePhotoUrl: null,
    phone: null,
    department: null,
    position: { title: "موظف" } as any,
  };

  return (
    <EmployeePortal 
      employee={employeeData as any} 
      salaryInfo={salaryInfo} 
      userName={session.user.name} 
    />
  );
}
