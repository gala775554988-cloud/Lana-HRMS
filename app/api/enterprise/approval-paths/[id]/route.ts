import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageApprovalRouting } from "@/config/request-routing";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { validateStages, validateActiveApprovers } from "@/lib/enterprise/approval-path-validation";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!canManageApprovalRouting(roles, session.user.permissions)) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session } as const;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const existing = await prisma.approvalPath.findUnique({ where: { id } });
    if (!existing) throw new Error("مسار الموافقة غير موجود");

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.entityId === "string" && body.entityId.trim()) data.entityId = body.entityId.trim();
    if (typeof body.requestType === "string" && body.requestType.trim()) data.requestType = body.requestType.toUpperCase().trim();

    if (Array.isArray(body.stages)) {
      const stages = validateStages(body.stages);
      await validateActiveApprovers(stages);
      await prisma.$transaction([
        prisma.approvalStage.deleteMany({ where: { approvalPathId: id } }),
        prisma.approvalStage.createMany({ data: stages.map((stage) => ({ ...stage, approvalPathId: id })) }),
        ...(Object.keys(data).length ? [prisma.approvalPath.update({ where: { id }, data })] : [])
      ]);
    } else if (Object.keys(data).length) {
      await prisma.approvalPath.update({ where: { id }, data });
    }

    await writeAuditLog({
      actorUserId: session!.user.id as string,
      action: "approval-path:update",
      entity: "approvalPath",
      entityId: id,
      metadata: { changes: Object.keys(data), stagesReplaced: Array.isArray(body.stages) }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "فشل تعديل مسار الموافقة" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  try {
    await prisma.approvalPath.delete({ where: { id } });
    await writeAuditLog({ actorUserId: session!.user.id as string, action: "approval-path:delete", entity: "approvalPath", entityId: id, metadata: {} });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "فشل حذف مسار الموافقة" }, { status: 400 });
  }
}
