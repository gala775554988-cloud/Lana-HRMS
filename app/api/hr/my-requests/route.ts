import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { persistEnterpriseWorkflow, notifyWorkflowSubmission } from "@/lib/enterprise/workflow";
import { resolveApprovalChain } from "@/lib/enterprise/approval-engine";
import { normalizeRequestType, REQUEST_CATEGORIES } from "@/config/request-routing";
import { ApprovalRoutingError } from "@/lib/enterprise/request-routing-policy";
import { formatApiError } from "@/lib/errors";
import { detectLeaveConflict } from "@/lib/enterprise/leave-engine";

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

    const contentType = request.headers.get("content-type") ?? "";
    const isJsonRequest = contentType.includes("application/json");
    const body = isJsonRequest
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
    const { type: rawType, employeeId: _clientEmployeeId, ...data } = body as Record<string, any>;

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
    const token = isJsonRequest ? request.headers.get("idempotency-key") : null;
    if (token && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token)) {
      return NextResponse.json({ success: false, message: "معرّف إعادة المحاولة غير صالح" }, { status: 400 });
    }
    const submissionKey = token ? `self-service.submission.${session.user.id}.${token.toLowerCase()}` : null;
    const success = () => NextResponse.json({ success: true, message: "تم إرسال الطلب بنجاح" });
    const fingerprint = submissionKey ? createHash("sha256").update(JSON.stringify({ rawType, data })).digest("hex") : null;
    const replay = async () => {
      if (!submissionKey) return null;
      const receipt = await prisma.appSetting.findUnique({ where: { key: submissionKey }, select: { value: true } });
      if (!receipt) return null;
      const original = receipt.value as { fingerprint?: string } | null;
      if (original?.fingerprint && original.fingerprint !== fingerprint) {
        return NextResponse.json({ success: false, message: "محتوى الطلب تغيّر. أعد فتح النموذج وحاول مرة أخرى." }, { status: 409 });
      }
      return success();
    };
    const previous = await replay();
    if (previous) return previous;

    const normalizedType = normalizeRequestType(String(rawType || ""));
    if (!REQUEST_CATEGORIES.some(category => category.code === normalizedType)) throw new ApprovalRoutingError("نوع الطلب غير صالح.");
    const type = normalizedType.toLowerCase();
    const approvers = await resolveApprovalChain(employeeId, normalizedType);
    const created = await prisma.$transaction(async (tx): Promise<any> => {
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

        const leaveType = await tx.leaveType.findFirst({
          where: { isActive: true, OR: [ ...(typeof data.leaveTypeId === "string" ? [{ id: data.leaveTypeId }] : []), { code: { equals: resolvedCode, mode: "insensitive" } }] },
        });

        if (!leaveType) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Leave Type Not Found",
                message: "نوع الإجازة المطلوب غير مُعرّف أو غير نشط. راجع الموارد البشرية.",
                cause: "لن يُستبدل نوع الإجازة تلقائياً بنوع آخر",
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

        if (leaveType.genderRestriction && employee.gender && leaveType.genderRestriction !== employee.gender) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Leave Type Not Applicable",
                message: `نوع الإجازة "${leaveType.name}" غير متاح لجنسك`,
                cause: "هذا النوع من الإجازات مقيد بجنس محدد",
                suggestion: "اختر نوع إجازة آخر",
              },
            },
            { status: 400 }
          );
        }

        const requestStartDate = new Date(data.startDate);
        const requestEndDate = new Date(data.endDate);
        if (!Number.isFinite(requestStartDate.getTime()) || !Number.isFinite(requestEndDate.getTime()) || requestEndDate < requestStartDate) throw new ApprovalRoutingError("تواريخ الإجازة غير صالحة.");
        const conflict = await detectLeaveConflict(employeeId, requestStartDate, requestEndDate);
        if (conflict) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Leave Conflict",
                message: `لديك طلب إجازة آخر (${conflict.leaveType.name}) يتعارض مع هذه التواريخ`,
                cause: "تتعارض هذه الفترة مع إجازة أخرى معتمدة أو قيد الانتظار",
                suggestion: "اختر تواريخ لا تتعارض مع إجازاتك الأخرى",
              },
            },
            { status: 409 }
          );
        }

        result = await tx.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId: leaveType.id,
            startDate: requestStartDate,
            endDate: requestEndDate,
            days: Math.floor((Date.UTC(requestEndDate.getUTCFullYear(), requestEndDate.getUTCMonth(), requestEndDate.getUTCDate()) - Date.UTC(requestStartDate.getUTCFullYear(), requestStartDate.getUTCMonth(), requestStartDate.getUTCDate())) / 86_400_000) + 1,
            reason: data.reason || "",
            status: "PENDING",
          },
        });
        break;
      }

      case "expense": {
        if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
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
        result = await tx.expenseRequest.create({
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
        if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
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
        result = await tx.loan.create({
          data: {
            employeeId,
            loanNumber: `LN-${Date.now()}`,
            principalAmount: Number(data.amount) || 0,
            outstandingAmount: Number(data.amount) || 0,
            installmentAmount: Math.round((Number(data.amount) || 0) / 12),
            currency: "SAR",
            issuedAt: new Date(),
            status: "PENDING",
            notes: data.notes || "",
          },
        });
        break;
      }

      case "letter":
        result = await tx.letterRequest.create({
          data: {
            employeeId,
            letterType: data.letterType || "salary",
            purpose: data.purpose || "",
            status: "PENDING",
          },
        });
        break;

      case "overtime": {
        if (!data.workDate || !Number.isFinite(Number(data.hours)) || Number(data.hours) <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Missing Required Fields",
                message: "يرجى تحديد تاريخ العمل وعدد الساعات",
                fields: [
                  ...(data.workDate ? [] : [{ field: "workDate", message: "تاريخ العمل مطلوب" }]),
                  ...(data.hours && Number(data.hours) > 0 ? [] : [{ field: "hours", message: "عدد الساعات مطلوب ويجب أن يكون أكبر من صفر" }]),
                ],
                suggestion: "أدخل تاريخ العمل وعدد الساعات وحاول مرة أخرى",
              },
            },
            { status: 400 }
          );
        }
        result = await tx.overtimeRequest.create({
          data: {
            employeeId,
            workDate: new Date(data.workDate),
            hours: Number(data.hours),
            reason: data.reason || data.notes || "",
            status: "PENDING",
          },
        });
        break;
      }

      case "resumption": {
        if (!data.returnDate) {
          return NextResponse.json(
            {
              success: false,
              error: {
                id: `VAL-${Date.now().toString(36)}`,
                category: "validation",
                name: "Missing Return Date",
                message: "يرجى تحديد تاريخ المباشرة الفعلية للعمل",
                fields: [{ field: "returnDate", message: "تاريخ المباشرة مطلوب" }],
                suggestion: "أدخل تاريخ المباشرة الفعلي وحاول مرة أخرى",
              },
            },
            { status: 400 }
          );
        }
        result = await tx.resumptionRequest.create({
          data: {
            employeeId,
            returnDate: new Date(data.returnDate),
            resumptionType: data.resumptionType || "AFTER_LEAVE",
            reason: data.reason || "",
            notes: data.notes || "",
            status: "PENDING",
          },
        });
        break;
      }

      case "residency":
      case "delegation":
      case "custody":
      case "document":
      case "documents":
      default:
        result = await tx.letterRequest.create({
          data: {
            employeeId,
            letterType: String(type || "general"),
            purpose: data.purpose || data.reason || data.notes || data.details || "",
            status: "PENDING",
          },
        });
        break;
    }

    const workflow = await persistEnterpriseWorkflow(tx, employeeId, normalizedType, result.id, approvers);
    if (submissionKey) await tx.appSetting.create({
      data: { key: submissionKey, value: { workflowId: workflow.id, fingerprint } },
    });
    return { record: result, workflow };
    }, { timeout: 15000 }).catch(async error => {
      const completed = await replay();
      if (completed) return completed;
      throw error;
    });
    if (created instanceof NextResponse) {
      return (await replay()) ?? created;
    }
    const result = created.record;
    await notifyWorkflowSubmission(created.workflow, approvers);

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

    if (!isJsonRequest) {
      return NextResponse.redirect(new URL("/employee/requests?created=1", request.url), { status: 303 });
    }

    return success();
  } catch (error: any) {
    console.error("Request creation failed:", error);
    const apiError = formatApiError(error, { location: "api/hr/my-requests", operation: "POST" });
    return NextResponse.json(apiError, { status: error?.statusCode || 500 });
  }
}
