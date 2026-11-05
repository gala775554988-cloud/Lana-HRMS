import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false, message: "لم يتم العثور على بيانات الموظف" }, { status: 403 });
  try {
    await prisma.$transaction(async tx => {
      const leave = await tx.leaveRequest.findUnique({ where: { id }, include: { leaveType: { select: { code: true } } } });
      if (!leave || leave.employeeId !== employee.id) throw Object.assign(new Error("الطلب غير موجود أو غير متاح."), { statusCode: 404 });
      if (["CANCELLED", "REJECTED"].includes(leave.status)) throw new Error("الطلب ملغى أو مرفوض بالفعل.");
      if (leave.status === "APPROVED") throw new Error("الإجازة معتمدة؛ قدّم طلب استرداد من الخدمات الذاتية ليوافق عليه المسؤول.");
      const workflows = await tx.workflowInstance.findMany({ where: { type: "LEAVE", entityId: id, status: { in: ["PENDING", "RETURNED"] } }, select: { id: true, status: true } });
      for (const workflow of workflows) {
        const claimed = await tx.workflowInstance.updateMany({ where: { id: workflow.id, status: workflow.status }, data: { status: "CANCELLED" } });
        if (claimed.count !== 1 || workflow.status === "CANCELLED") throw new Error("تغير الطلب أثناء الإلغاء. حدّث الصفحة.");
      }
      const cancelled = await tx.leaveRequest.updateMany({ where: { id, status: leave.status }, data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: "ألغاه الموظف" } });
      if (cancelled.count !== 1) throw new Error("تغير الطلب أثناء الإلغاء. حدّث الصفحة.");
      if (workflows.length) await tx.workflowStep.updateMany({ where: { workflowInstanceId: { in: workflows.map(workflow => workflow.id) }, status: { in: ["WAITING", "PENDING", "DEFERRED"] } }, data: { status: "CANCELLED" } });
      await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "leave:cancel", entity: "leaveRequest", entityId: id, metadata: { wasApproved: false } } });
    });
    return NextResponse.json({ success: true, message: "تم إلغاء الطلب ومسار اعتماده." });
  } catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: (error as { statusCode?: number }).statusCode ?? 409 }); }
}
