import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { recordMovement } from "@/lib/enterprise/social-insurance";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

function can(permissions: string[], roles: string[], action: string) {
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action, resource: "social-insurance" }, roles);
}

// Attaches an already-uploaded file (see /api/uploads, kind=document) to an
// employee's Social Insurance file. Reuses the generic EmployeeDocument
// table with type="SOCIAL_INSURANCE" rather than a bespoke document model
// -- same convention every other module (contracts, insurance) already
// uses for per-employee attachments.
export async function POST(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  if (!can(permissions, roles, "edit") || !isEnterpriseResourceAllowed(roles, "social-insurance")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const { employeeId } = await params;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });

  const body = await request.json().catch(() => null) as { fileUrl?: string; fileName?: string; name?: string; expiresAt?: string } | null;
  if (!body?.fileUrl) return NextResponse.json({ success: false, message: "fileUrl is required" }, { status: 400 });

  const document = await prisma.employeeDocument.create({
    data: {
      employeeId,
      type: "SOCIAL_INSURANCE",
      name: body.name || body.fileName || "مستند تأمينات اجتماعية",
      fileUrl: body.fileUrl,
      fileName: body.fileName ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      source: "MANUAL"
    }
  });

  await writeAuditLog({ actorUserId: session.user.id, action: "create", entity: "employeeDocument", entityId: document.id, metadata: { employeeId, type: "SOCIAL_INSURANCE" } });

  const record = await prisma.socialInsuranceRecord.findUnique({ where: { employeeId }, select: { id: true } });
  if (record) {
    await recordMovement({
      recordId: record.id,
      employeeId,
      type: "DOCUMENT_ADDED",
      description: `إضافة مستند: ${document.name}`,
      newValue: { documentId: document.id, name: document.name },
      actorUserId: session.user.id
    });
  }

  return NextResponse.json({ success: true, document });
}
