"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createEnterpriseWorkflow } from "@/lib/enterprise/workflow";
import { createEnterpriseNotification, notifyUsers } from "@/lib/enterprise/notifications";
import { writeAuditLog } from "@/lib/audit";

/**
 * Enterprise Request Server Action (`createRequest` / `createEmployeeRequest`)
 * -----------------------------------------------------------------------------
 * 1. Stores the request securely in Neon PostgreSQL (`Prisma ORM`).
 * 2. Triggers our vertical Auto-Pipeline Engine (`createEnterpriseWorkflow`)
 *    to dynamically resolve the live Level 1 approver (`DIRECT_MANAGER` / `HOSPITAL_SUPERVISOR`)
 *    and generate vertical approval steps (`WorkflowStep`) cleanly.
 * 3. Dispatches immediate push & in-app notifications (`notifications`) to the live approver
 *    instead of hardcoding `"ADMIN_ID"`.
 * 4. Revalidates Next.js cache paths (`revalidatePath`) for instant UI synchronization.
 */
export async function createRequest(data: {
  userId?: string;
  employeeId?: string;
  type: string;
  details: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await auth();
  const actorUserId = session?.user?.id || data.userId;
  if (!actorUserId) {
    return { success: false, message: "Unauthorized: Session required to create request" };
  }

  // Resolve target employee card
  let employeeId = data.employeeId;
  if (!employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { userId: actorUserId },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true }
    });
    if (!emp) {
      return { success: false, message: "لم يتم العثور على بطاقة موظف مرتبطة بهذا الحساب" };
    }
    employeeId = emp.id;
  }

  const cleanType = (data.type || "GENERAL").toUpperCase().trim();
  let entityId = `req-${Date.now()}`;
  let requestSummary = data.details || `طلب ${cleanType}`;

  try {
    // 1. Store request in specific domain table if applicable, or generic request instance
    if (cleanType === "LEAVE" || cleanType === "إجازة") {
      const sDate = data.startDate ? new Date(data.startDate) : new Date();
      const eDate = data.endDate ? new Date(data.endDate) : new Date(Date.now() + 86400000);
      const diffDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));

      const leaveReq = await prisma.leaveRequest.create({
        data: {
          employeeId,
          leaveType: "ANNUAL",
          startDate: sDate,
          endDate: eDate,
          daysRequested: diffDays,
          reason: data.details || "طلب إجازة عبر البوابة الموحدة",
          status: "PENDING"
        }
      });
      entityId = leaveReq.id;
      requestSummary = `طلب إجازة (${diffDays} أيام): ${data.details}`;
    } else if (cleanType === "OVERTIME" || cleanType === "عمل إضافي") {
      const ovReq = await prisma.overtimeRequest.create({
        data: {
          employeeId,
          workDate: data.startDate ? new Date(data.startDate) : new Date(),
          hours: 2,
          reason: data.details || "ساعات عمل إضافية معتمدة",
          status: "PENDING"
        }
      });
      entityId = ovReq.id;
      requestSummary = `طلب عمل إضافي: ${data.details}`;
    }

    // 2. Trigger Vertical Auto-Pipeline Engine (resolves dynamic approver hierarchy)
    const workflowInstance = await createEnterpriseWorkflow(employeeId, cleanType, entityId);

    // 3. Smart Notification Trigger: Notify the exact active Level 1 approver (or fallback to HR_MANAGER)
    const activeStep = await prisma.workflowStep.findFirst({
      where: { workflowInstanceId: workflowInstance.id, status: "PENDING" },
      select: { approverUserId: true }
    });

    if (activeStep?.approverUserId) {
      await createEnterpriseNotification({
        userId: activeStep.approverUserId,
        title: `طلب جديد: ${cleanType}`,
        body: `قام الموظف بتقديم طلب جديد في انتظار اعتمادك المباشر: "${requestSummary}"`,
        type: "INFO",
        pushToMobile: true, // Trigger live mobile PWA & FCM/OneSignal push
        link: `/approvals?tab=inbox&highlight=${workflowInstance.id}`
      });
    } else {
      // Fallback: Notify HR Managers if no direct approver was resolved
      const hrAdmins = await prisma.userRole.findMany({
        where: { role: { name: { in: ["HR_MANAGER", "SUPER_ADMIN"] } } },
        select: { userId: true },
        take: 5
      });
      const hrUserIds = hrAdmins.map((r) => r.userId).filter(Boolean);
      if (hrUserIds.length > 0) {
        await notifyUsers(hrUserIds, `طلب جديد: ${cleanType}`, `طلب جديد ينتظر الاعتماد الإداري: "${requestSummary}"`, "INFO", `/approvals?tab=inbox&highlight=${workflowInstance.id}`);
      }
    }

    // 4. Audit Log
    await writeAuditLog({
      actorUserId,
      action: `request:create:${cleanType.toLowerCase()}`,
      entity: "WorkflowInstance",
      entityId: workflowInstance.id,
      metadata: { employeeId, type: cleanType, details: data.details }
    }).catch(() => {});

    // 5. Cache Revalidation for instant UI refresh
    revalidatePath("/dashboard");
    revalidatePath("/requests");
    revalidatePath("/approvals");
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      requestId: workflowInstance.id,
      entityId,
      message: "تم إنشاء الطلب وتوجيهه تلقائياً للمراجع المعتمد في التسلسل الإداري بنجاح"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `تعذر إنشاء الطلب: ${message}` };
  }
}
