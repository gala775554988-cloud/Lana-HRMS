import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, employeeId, ...data } = body;

    // Security: verify the employee belongs to this user
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        userId: session.user.id,
      },
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found or access denied" }, { status: 403 });
    }

    let result;

    switch (type) {
      case "leave":
        result = await prisma.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId: data.leaveType || "annual", // fallback
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            days: 1, // calculate properly in real app
            reason: data.reason,
            status: "PENDING",
          },
        });
        break;

      case "loan":
        result = await prisma.loan.create({
          data: {
            employeeId,
            loanNumber: `LN-${Date.now()}`,
            principalAmount: data.amount,
            outstandingAmount: data.amount,
            installmentAmount: Math.round(data.amount / 12),
            currency: "SAR",
            issuedAt: new Date(),
            status: "ACTIVE", // loan requests start as ACTIVE (no PENDING in enum)
            notes: data.notes,
          },
        });
        break;

      case "overtime":
        result = await prisma.overtimeRequest.create({
          data: {
            employeeId,
            workDate: new Date(),
            hours: data.hours || 2,
            rate: 1.5,
            reason: data.details || "طلب أوفر تايم",
            status: "PENDING",
          },
        });
        break;

      default:
        // Generic request (complaint, residence, delegation)
        result = await prisma.announcement.create({
          data: {
            title: `طلب ${type} من ${employee.firstName}`,
            body: data.details || JSON.stringify(data),
            audience: "HR",
            isPublished: false,
          },
        });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "create",
        entity: type,
        entityId: result.id,
        metadata: { employeeId, type },
      },
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error: any) {
    console.error("Request creation failed:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create request" },
      { status: 500 }
    );
  }
}
