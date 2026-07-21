import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { reverseLeaveApprovalUsage } from "@/lib/employee/leave-balance";
import { reverseLeaveTypeApprovalUsage } from "@/lib/enterprise/leave-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Self-service cancel for an employee's own leave request -- PENDING is
 * always cancellable, an APPROVED one only if it hasn't started yet (once a
 * leave is underway, cancelling retroactively is an HR/attendance decision,
 * not a self-service one). Reverses both balance representations (aggregate
 * + per-type) if the request had already been approved and consumed
 * balance, and marks the underlying workflow CANCELLED so it drops off any
 * approver's pending inbox. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false, message: "لم يتم العثور على بيانات الموظف" }, { status: 403 });

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
  if (leaveRequest.employeeId !== employee.id) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  if (leaveRequest.status === "CANCELLED" || leaveRequest.status === "REJECTED") {
    return NextResponse.json({ success: false, message: "الطلب ملغى أو مرفوض بالفعل" }, { status: 409 });
  }
  if (leaveRequest.status === "APPROVED" && leaveRequest.startDate <= new Date()) {
    return NextResponse.json({ success: false, message: "لا يمكن إلغاء إجازة بدأت بالفعل -- تواصل مع الموارد البشرية" }, { status: 409 });
  }

  const wasApproved = leaveRequest.status === "APPROVED";

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: "ألغاه الموظف" }
  });

  if (wasApproved) {
    const days = Number(leaveRequest.days);
    await reverseLeaveApprovalUsage(employee.id, days).catch(() => null);
    await reverseLeaveTypeApprovalUsage(employee.id, leaveRequest.leaveTypeId, days, leaveRequest.startDate).catch(() => null);
  }

  await prisma.workflowInstance.updateMany({
    where: { type: "LEAVE", entityId: id, status: "PENDING" },
    data: { status: "CANCELLED" }
  }).catch(() => null);

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "leave:cancel",
    entity: "leaveRequest",
    entityId: id,
    metadata: { wasApproved }
  });

  return NextResponse.json({ success: true, message: "تم إلغاء طلب الإجازة" });
}
