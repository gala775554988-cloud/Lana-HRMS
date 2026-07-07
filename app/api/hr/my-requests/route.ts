import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflow } from "@/lib/employee/workflow";
import { formatApiError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            id: `AUTH-${Date.now().toString(36)}`,
            category: "auth",
            name: "Authentication Required",
            message: "غير مصرح - يرجى تسجيل الدخول",
            cause: "لم يتم تقديم بيانات مصادقة صالحة",
            suggestion: "سجل الدخول مرة أخرى",
            statusCode: 401,
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, employeeId: _clientEmployeeId, ...data } = body;

    // Always resolve employee from session — never trust client-sent employeeId
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
    });

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: {
            id: `AUTH-${Date.now().toString(36)}`,
            category: "auth",
            name: "Employee Not Found",
            message: "لم يتم العثور على بيانات الموظف المرتبطة بحسابك",
            cause: "حساب المستخدم غير مرتبط بسجل موظف",
            suggestion: "تواصل مع الموارد البشرية لربط حسابك بملف الموظف",
            statusCode: 403,
          },
        },
        { status: 403 }
      );
    }

    const employeeId = employee.id;
    let result: any;

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
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Leave Type Not Found",
                message: "لا توجد أنواع إجازات مُعرّفة في النظام",
                cause: "لم يتم العثور على نوع الإجازة المطلوب ولا أنواع إجازات افتراضية",
                suggestion: "تواصل مع الإدارة لإعداد أنواع الإجازات في النظام",
              },
            },
            { status: 400 }
          );
        }

        // Validate required fields
        if (!data.startDate || !data.endDate) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Missing Required Fields",
                message: "يرجى تحديد تاريخ البداية والنهاية للإجازة",
                cause: "حقول تاريخ البداية والنهاية مطلوبة",
                suggestion: "أدخل تواريخ الإجازة وحاول مرة أخرى",
                fields: [
                  ...(data.startDate ? [] : [{ field: "startDate", message: "تاريخ البداية مطلوب" }]),
                  ...(data.endDate ? [] : [{ field: "endDate", message: "تاريخ النهاية مطلوب" }]),
                ],
              },
            },
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

      case "expense": {
        if (!data.amount || Number(data.amount) <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Invalid Amount",
                message: "يرجى إدخال مبلغ صالح للطلب",
                fields: [{ field: "amount", message: "المبلغ مطلوب ويجب أن يكون أكبر من صفر" }],
                suggestion: "أدخل مبلغ صحيح وحاول مرة أخرى",
              },
            },
            { status: 400 }
          );
        }
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
      }

      case "loan": {
        if (!data.amount || Number(data.amount) <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Invalid Amount",
                message: "يرجى إدخال مبلغ صالح للسلفة",
                fields: [{ field: "amount", message: "المبلغ مطلوب ويجب أن يكون أكبر من صفر" }],
                suggestion: "أدخل مبلغ صحيح وحاول مرة أخرى",
              },
            },
            { status: 400 }
          );
        }
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
      }

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

      case "residency":
      case "delegation":
      case "custody":
      case "document":
      case "documents":
      default:
        result = await prisma.letterRequest.create({
          data: {
            employeeId,
            letterType: String(type || "general"),
            purpose: data.purpose || data.reason || data.notes || data.details || "",
            status: "PENDING",
          },
        });
        break;
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
    const apiError = formatApiError(error, { location: "api/hr/my-requests", operation: "POST" });
    return NextResponse.json(apiError, { status: error?.statusCode || 500 });
  }
}
