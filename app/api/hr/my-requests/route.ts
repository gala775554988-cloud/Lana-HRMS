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
  const { type, ...data } = body;

  // Find the employee by the logged-in user's ID — never trust client-sent employeeId
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
  });

  if (!employee) {
    return NextResponse.json({ success: false, message: "لم يتم العثور على بيانات الموظف المرتبطة بحسابك" }, { status: 403 });
  }

  const employeeId = employee.id;
  let result: any;
  const requestType = type.toUpperCase();

  try {
    switch (type) {
      case "leave": {
        // Find the leave type record — prefer lookup by code, fallback to first active
        let leaveTypeId = data.leaveTypeId;
        if (!leaveTypeId || leaveTypeId === "annual" || leaveTypeId === "sick" || leaveTypeId === "emergency") {
          const leaveType = await prisma.leaveType.findFirst({
            where: { code: { equals: data.leaveType || data.leaveTypeId || "ANNUAL", mode: "insensitive" } },
          });
          leaveTypeId = leaveType?.id;
        }

        if (!leaveTypeId) {
          // Fallback: use the first available leave type
          const firstType = await prisma.leaveType.findFirst({ where: { isActive: true } });
          if (!firstType) {
            return NextResponse.json({ success: false, message: "لا توجد أنواع إجازات مُعرّفة في النظام. يرجى التواصل مع الإدارة." }, { status: 400 });
          }
          leaveTypeId = firstType.id;
        }

        result = await prisma.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            days: Number(data.days) || 1,
            reason: data.reason || "",
            status: "PENDING",
          },
        });
        break;
      }

      case "expense":
        result = await prisma.expenseRequest.create({
          data: {
            employeeId,
            amount: Number(data.amount) || 0,
            category: data.category || "general",
            description: data.description || data.notes || "",
            status: "PENDING",
          },
        });
        break;

      case "loan":
        result = await prisma.loan.create({
          data: {
            employeeId,
            loanNumber: `LN-${Date.now()}`,
            principalAmount: Number(data.amount) || 0,
            outstandingAmount: Number(data.amount) || 0,
            installmentAmount: Math.round((Number(data.amount) || 0) / 12),
            currency: "SAR",
            issuedAt: new Date(),
            status: "ACTIVE",
            notes: data.notes || "",
          },
        });
        break;

      case "letter":
        result = await prisma.letterRequest.create({
          data: {
            employeeId,
            letterType: data.letterType || "salary",
            purpose: data.purpose || "",
            status: "PENDING",
          },
        });
        break;

      default:
        return NextResponse.json({ success: false, message: "نوع طلب غير معروف" }, { status: 400 });
    }

    // Create Workflow automatically
    try {
      await createWorkflow(employeeId, requestType, result.id);
    } catch (workflowError) {
      console.error("Workflow creation failed (non-blocking):", workflowError);
    }

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

    return NextResponse.json({ success: true, message: "تم إرسال الطلب بنجاح" });
  } catch (error: any) {
    console.error("Request creation failed:", error);
    return NextResponse.json({ success: false, message: "فشل إنشاء الطلب. يرجى المحاولة لاحقاً." }, { status: 500 });
  }
}
