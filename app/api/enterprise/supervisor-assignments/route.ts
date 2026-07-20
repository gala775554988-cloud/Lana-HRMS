import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { invalidateEffectivePermissions } from "@/lib/enterprise/permissions";
import type { ApprovalEntityType } from "@prisma/client";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) } as const;
  const roles = ((session.user as any).roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session } as const;
}

async function resolveEntityNames(assignments: Array<{ entityType: ApprovalEntityType; entityId: string }>) {
  const idsByType: Record<string, Set<string>> = { HOSPITAL: new Set(), DEPARTMENT: new Set(), BRANCH: new Set(), PROJECT: new Set() };
  for (const assignment of assignments) idsByType[assignment.entityType]?.add(assignment.entityId);

  const [hospitals, departments, branches, projects] = await Promise.all([
    prisma.hospital.findMany({ where: { id: { in: Array.from(idsByType.HOSPITAL) } }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { id: { in: Array.from(idsByType.DEPARTMENT) } }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { id: { in: Array.from(idsByType.BRANCH) } }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { id: { in: Array.from(idsByType.PROJECT) } }, select: { id: true, name: true } })
  ]);
  const names = new Map<string, string>();
  for (const row of [...hospitals, ...departments, ...branches, ...projects]) names.set(row.id, row.name);
  return names;
}

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const entityType = (params.get("entityType") as ApprovalEntityType | null) || undefined;
  const entityId = params.get("entityId") || undefined;
  const isActive = params.get("isActive");

  const assignments = await prisma.supervisorAssignment.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(isActive === "true" ? { isActive: true } : isActive === "false" ? { isActive: false } : {})
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: { startDate: "desc" }
  });

  const entityNames = await resolveEntityNames(assignments);
  const result = assignments.map((assignment) => ({
    id: assignment.id,
    employeeId: assignment.employeeId,
    employeeLabel: `${assignment.employee.firstName} ${assignment.employee.lastName} (${assignment.employee.employeeNumber})`,
    entityType: assignment.entityType,
    entityId: assignment.entityId,
    entityName: entityNames.get(assignment.entityId) ?? assignment.entityId,
    title: assignment.title,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    isActive: assignment.isActive
  }));

  return NextResponse.json({ success: true, assignments: result });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));

  try {
    if (!body.employeeId) throw new Error("الموظف مطلوب");
    if (!body.entityType) throw new Error("نوع الجهة مطلوب");
    if (!body.entityId) throw new Error("اسم الجهة مطلوب");
    if (!body.startDate) throw new Error("تاريخ بداية التكليف مطلوب");

    const assignment = await prisma.supervisorAssignment.create({
      data: {
        employeeId: body.employeeId,
        entityType: body.entityType,
        entityId: body.entityId,
        title: typeof body.title === "string" ? body.title.trim() || null : null,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive !== false
      }
    });

    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId }, select: { userId: true } });
    if (employee?.userId) invalidateEffectivePermissions(employee.userId);

    await writeAuditLog({
      actorUserId: session!.user.id as string,
      action: "supervisor-assignment:create",
      entity: "supervisorAssignment",
      entityId: assignment.id,
      metadata: { employeeId: body.employeeId, entityType: body.entityType, entityId: body.entityId }
    });

    return NextResponse.json({ success: true, assignment });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "فشل إنشاء التكليف" }, { status: 400 });
  }
}
