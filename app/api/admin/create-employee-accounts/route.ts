import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    where: { userId: null },
    select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, email: true },
    take: 10,
  });

  let created = 0;
  let errors = 0;
  const errs: string[] = [];
  const temporaryCredentials: Array<{ employeeNumber: string; username: string; temporaryPassword: string }> = [];

  const employeeRole = await prisma.role.upsert({
    where: { name: "EMPLOYEE" },
    update: {},
    create: { name: "EMPLOYEE", description: "Employee", isSystem: true },
  });

  for (const emp of employees) {
    try {
      const nationalId = emp.nationalId || `EMP-${emp.employeeNumber}`;
      const temporaryPassword = generateTemporaryPassword();
      const pwHash = await hashPassword(temporaryPassword);
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      const email = emp.email || `emp.${emp.employeeNumber}@lana.local`;

      let user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: pwHash, isActive: true, mustChangePassword: true, passwordChanged: false } });
      } else {
        user = await prisma.user.create({
          data: { name: fullName, email, passwordHash: pwHash, isActive: true, emailVerified: new Date(), mustChangePassword: true, passwordChanged: false },
        });
      }
      await prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
      await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } }, update: {}, create: { userId: user.id, roleId: employeeRole.id } });
      created++;
      temporaryCredentials.push({ employeeNumber: emp.employeeNumber, username: nationalId, temporaryPassword });
    } catch (e: any) {
      errors++;
      if (errs.length < 3) errs.push(`${emp.employeeNumber}: ${e.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    batch: employees.length,
    created,
    errors,
    sampleErrors: errs,
    temporaryCredentials,
    note: "Run again for next batch if needed",
  });
}
