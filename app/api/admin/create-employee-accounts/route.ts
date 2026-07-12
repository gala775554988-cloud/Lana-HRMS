import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST() {
  const employees = await prisma.employee.findMany({
    where: { userId: null },
    select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, email: true },
  });

  let created = 0;
  let errors = 0;
  const results: string[] = [];

  const employeeRole = await prisma.role.upsert({
    where: { name: "EMPLOYEE" },
    update: {},
    create: { name: "EMPLOYEE", description: "Employee", isSystem: true },
  });

  for (const emp of employees) {
    try {
      const nationalId = emp.nationalId || `EMP-${emp.employeeNumber}`;
      const last4 = nationalId.slice(-4).padStart(4, "0");
      const pwHash = await hashPassword(last4);
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      const email = emp.email || `emp.${emp.employeeNumber}@lana.local`;

      const user = await prisma.user.upsert({
        where: { email },
        update: { name: fullName, passwordHash: pwHash, isActive: true, emailVerified: new Date(), mustChangePassword: true, passwordChanged: false },
        create: { name: fullName, email, passwordHash: pwHash, isActive: true, emailVerified: new Date(), mustChangePassword: true, passwordChanged: false },
      });

      await prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
        update: {}, create: { userId: user.id, roleId: employeeRole.id },
      });
      created++;
    } catch (e: any) {
      errors++;
      if (errors <= 5) results.push(`${emp.employeeNumber}: ${e.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    total: employees.length,
    created,
    errors,
    sampleErrors: results.slice(0, 5),
  });
}
