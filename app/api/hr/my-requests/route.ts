import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflow } from "@/lib/employee/workflow";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, employeeId, ...data } = body;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, userId: session.user.id },
  });

  if (!employee) {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }

  let result: any;
  const requestType = type.toUpperCase();

  try {
    switch (type) {
      case "leave":
        result = await prisma.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId: data.leaveTypeId || "annual",
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            days: data.days || 1,
            reason: data.reason,
            status: "PENDING",
          },
        });
        break;

      case "expense":
        result = await prisma.expenseRequest.create({
          data: {
            employeeId,
            amount: data.amount,
            category: data.category || "general",
            description: data.description,
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
            status: "ACTIVE",
            notes: data.notes,
          },
        });
        break;

      case "letter":
        result = await prisma.letterRequest.create({
          data: {
            employeeId,
            letterType: data.letterType || "salary",
            purpose: data.purpose,
            status: "PENDING",
          },
        });
        break;

      default:
        return NextResponse.json({ success: false, message: "Unknown request type" }, { status: 400 });
    }

    // === CRITICAL: Create Workflow automatically ===
    await createWorkflow(employeeId, requestType, result.id);

    // Audit
    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "create",
        entity: type,
        entityId: result.id,
        metadata: { employeeId, type },
      },
    });

    return NextResponse.json({ success: true, id: result.id, type });
  } catch (error: any) {
    console.error("Request creation failed:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
