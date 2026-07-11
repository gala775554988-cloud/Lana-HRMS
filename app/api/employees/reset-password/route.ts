import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user.roles as string[]) || [];
    const permissions = (session.user.permissions as string[]) || [];
    
    // Only HR and Super Admin can reset
    const isSuperAdmin = roles.includes("SUPER_ADMIN");
    const isHRManager = roles.includes("HR_MANAGER");
    const hasManagePermission = hasPermission(permissions, { action: "manage", resource: "employees" }, roles);
    
    if (!isSuperAdmin && !isHRManager && !hasManagePermission) {
      return NextResponse.json({ success: false, message: "Forbidden: Only HR and Super Admin can reset passwords" }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, employeeIds, resetAll } = body;

    let targets: string[] = [];
    
    if (resetAll) {
      // Reset all employees
      const allEmployees = await prisma.employee.findMany({
        where: { nationalId: { not: null } },
        select: { id: true },
      });
      targets = allEmployees.map(e => e.id);
    } else if (employeeIds && Array.isArray(employeeIds)) {
      targets = employeeIds;
    } else if (employeeId) {
      targets = [employeeId];
    } else {
      return NextResponse.json({ success: false, message: "employeeId or employeeIds or resetAll required" }, { status: 400 });
    }

    let resetCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];
    const results: any[] = [];

    for (const id of targets) {
      try {
        const employee = await prisma.employee.findUnique({
          where: { id },
          include: { user: true },
        });

        if (!employee) {
          skippedCount++;
          errors.push({ id, reason: "Employee not found" });
          continue;
        }

        if (!employee.nationalId || employee.nationalId.trim() === "" || employee.nationalId.toUpperCase() === "NA") {
          skippedCount++;
          errors.push({ id, name: `${employee.firstName} ${employee.lastName}`, reason: "No nationalId - cannot reset" });
          continue;
        }

        const last4 = employee.nationalId.slice(-4);
        const newHash = await hashPassword(last4);

        let userId = employee.userId;

        if (employee.user) {
          await prisma.user.update({
            where: { id: employee.user.id },
            data: {
              passwordHash: newHash,
              mustChangePassword: true,
              passwordChanged: false,
              passwordChangedAt: null,
              lastPasswordResetBy: session.user.id,
              lastPasswordResetAt: new Date(),
            },
          });
          userId = employee.user.id;
        } else {
          // Create user if not exists
          const newUser = await prisma.user.create({
            data: {
              username: employee.nationalId,
              email: employee.email ? employee.email.toLowerCase() : `employee.${employee.nationalId}@lana.local`,
              name: `${employee.firstName} ${employee.lastName}`.trim(),
              passwordHash: newHash,
              isActive: true,
              emailVerified: new Date(),
              mustChangePassword: true,
              passwordChanged: false,
            },
          });

          await prisma.employee.update({
            where: { id: employee.id },
            data: { userId: newUser.id },
          });

          // Assign EMPLOYEE role
          const employeeRole = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
          if (employeeRole) {
            await prisma.userRole.upsert({
              where: { userId_roleId: { userId: newUser.id, roleId: employeeRole.id } },
              update: {},
              create: { userId: newUser.id, roleId: employeeRole.id },
            });
          }

          userId = newUser.id;
        }

        // Audit log
        await writeAuditLog({
          actorUserId: session.user.id,
          action: "PASSWORD_RESET",
          entity: "user",
          entityId: userId,
          metadata: {
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            nationalId: employee.nationalId,
            resetTo: "last4",
            timestamp: new Date().toISOString(),
          },
        }).catch(() => {});

        resetCount++;
        results.push({ id: employee.id, name: `${employee.firstName} ${employee.lastName}`, nationalId: employee.nationalId, newPassword: last4 });
      } catch (e: any) {
        skippedCount++;
        errors.push({ id, error: e.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم إعادة تعيين ${resetCount} كلمة مرور`,
      resetCount,
      skippedCount,
      total: targets.length,
      results: results.slice(0, 10), // Show first 10 for security
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("[reset-password] error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
