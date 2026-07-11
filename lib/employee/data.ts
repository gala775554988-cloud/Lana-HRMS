import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { EmployeeProfile } from "@/types/employee";
import { cache } from "react";

// Cached version to prevent duplicate queries
export const getCurrentEmployee = cache(async () => {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        employeeNumber: true,
        nationalId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profilePhotoUrl: true,
        hireDate: true,
        status: true,
        department: { select: { name: true, code: true } },
        position: { select: { title: true } },
        branch: { select: { name: true } },
      },
    });

    if (!employee) return null;

    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      nationalId: employee.nationalId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      profilePhotoUrl: employee.profilePhotoUrl,
      department: employee.department,
      position: employee.position,
      branch: employee.branch,
      hireDate: employee.hireDate,
      status: employee.status,
    } as EmployeeProfile;
  } catch (error) {
    console.error("[getCurrentEmployee] Error:", error);
    return null;
  }
});