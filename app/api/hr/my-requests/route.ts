import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflow } from "@/lib/employee/workflow";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json();
  const { type, employeeId: _clientEmployeeId, ...data } = body;

  // Always resolve employee from session — never trust client-sent employeeId
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
  });

  if (!employee) {
    return NextResponse.json(
      { success: false, message: "لم يتم العثور على بيانات الموظف المرتبطة بحسابك" },
      { status: 403 }
    );
  }

  const employeeId = employee.id;
  let result: any;

  try {
    switch (type) {
      case "leave": {
        // Resolve leaveTypeId from the code/name sent by the form
        const leaveTypeCode = (data.leaveType || data.leaveTypeId || "ANNUAL")
          .toUpperCase()
          .replace(/\s/g, "_");

        // Map common Arabic/English names to codes
        const codeMap: Record<string, string> = {
          "سنوية": "ANNUAL",
          "مرضية": "SICK",
          "طارئة": "EMERGENCY",
          "ANNUAL": "ANNUAL",
          "SICK": "SICK",
          "EMERGENCY": "EMERGENCY",
        };

        const resolvedCode = codeMap[leaveTypeCode] || leaveTypeCode;

        // Try to find existing LeaveType by code
        let leaveType = await prisma.leaveType.findFirst({
          where: { code: { equals: resolvedCode, mode: "insensitive" } },
        });

        // If not found, try to find any active leave type
        if (!leaveType) {
          leaveType = await prisma.leaveType.findFirst({
            where: { isActive: true },
          });
        }

        // If still not found, auto-create the default leave types so the system works
        if (!leaveType) {
          await prisma.leaveType.createMany({
            data: [
              { name: "إجازة سنوية", code: "ANNUAL", annualLimit: 30, isPaid: true, isActive: true },
              { name: "إجازة مرضية", code: "SICK", annualLimit: 15, isPaid: true, isActive: true },
              { name: "إجازة طارئة", code: "EMERGENCY", annualLimit: 5, isPaid: true, isActive: true },
            ],
            skipDuplicates: true,
          });

          leaveType = await prisma.leaveType.findFirst({
            where: { code: resolvedCode, isActive: true },
          }) || await prisma.leaveType.findFirst({
            where: { isActive: true },
          });
        }

        if (!leaveType) {
          return NextResponse.json(
            { success: false, message: "لا توجد أنواع إجازات مُعرّفة في النظام. يرجى التواصل مع الإدارة." },
            { status: 400 }
          );
        }

        result = await prisma.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId: leaveType.id,
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
        return NextResponse.json(
          { success: false, message: "نوع طلب غير معروف" },
          { status: 400 }
        );
    }

    // Create Workflow automatically (non-blocking)
    try {
      await createWorkflow(employeeId, type.toUpperCase(), result.id);
    } catch (workflowError) {
      console.error("Workflow creation failed (non-blocking):", workflowError);
    }

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "create",
          entity: type,
          entityId: result.id,
          metadata: { employeeId, type },
        },
      });
    } catch (auditError) {
      console.error("Audit log failed (non-blocking):", auditError);
    }

    return NextResponse.json({ success: true, message: "تم إرسال الطلب بنجاح" });
  } catch (error: any) {
    console.error("Request creation failed:", error);
    return NextResponse.json(
      { success: false, message: "فشل إنشاء الطلب. يرجى المحاولة لاحقاً." },
      { status: 500 }
    );
  }
}
