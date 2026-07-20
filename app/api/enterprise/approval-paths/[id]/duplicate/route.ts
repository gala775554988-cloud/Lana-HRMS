import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session } as const;
}

// Duplicates a path's stages onto a new (entityId, requestType) target --
// lets an admin reuse a fully-built stage list for another hospital/branch
// instead of rebuilding it stage by stage.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const source = await prisma.approvalPath.findUnique({ where: { id }, include: { stages: { orderBy: { order: "asc" } } } });
    if (!source) throw new Error("مسار الموافقة المصدر غير موجود");

    const entityId = typeof body.entityId === "string" && body.entityId ? body.entityId : source.entityId;
    const entityType = typeof body.entityType === "string" && body.entityType ? body.entityType : source.entityType;
    const requestType = typeof body.requestType === "string" && body.requestType ? body.requestType.toUpperCase().trim() : source.requestType;
    const companyId = typeof body.companyId === "string" && body.companyId ? body.companyId : source.companyId;

    const copy = await prisma.approvalPath.create({
      data: {
        companyId,
        entityType,
        entityId,
        requestType,
        name: source.name ? `${source.name} (نسخة)` : null,
        isActive: true,
        stages: {
          create: source.stages.map((stage) => ({ order: stage.order, name: stage.name, approverEmployeeId: stage.approverEmployeeId, isMandatory: stage.isMandatory }))
        }
      },
      include: { stages: true }
    });

    await writeAuditLog({ actorUserId: session!.user.id as string, action: "approval-path:duplicate", entity: "approvalPath", entityId: copy.id, metadata: { sourceId: id } });
    return NextResponse.json({ success: true, path: copy });
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل نسخ مسار الموافقة";
    const isDuplicate = message.includes("Unique constraint");
    return NextResponse.json({ success: false, message: isDuplicate ? "يوجد مسار موافقة بنفس الشركة والجهة ونوع الطلب مسبقاً" : message }, { status: 400 });
  }
}
