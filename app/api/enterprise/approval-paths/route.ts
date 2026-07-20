import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
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

const ENTITY_MODELS = {
  HOSPITAL: "hospital",
  DEPARTMENT: "department",
  BRANCH: "branch",
  PROJECT: "project"
} as const;

async function resolveEntityNames(paths: Array<{ entityType: ApprovalEntityType; entityId: string }>) {
  const idsByType: Record<string, Set<string>> = { HOSPITAL: new Set(), DEPARTMENT: new Set(), BRANCH: new Set(), PROJECT: new Set() };
  for (const path of paths) idsByType[path.entityType]?.add(path.entityId);

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
  const companyId = params.get("companyId") || undefined;
  const entityType = (params.get("entityType") as ApprovalEntityType | null) || undefined;
  const entityId = params.get("entityId") || undefined;
  const requestType = params.get("requestType") || undefined;
  const search = params.get("search")?.trim() || undefined;

  const paths = await prisma.approvalPath.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(requestType ? { requestType } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { requestType: { contains: search, mode: "insensitive" } }] } : {})
    },
    include: {
      company: { select: { id: true, name: true } },
      stages: {
        orderBy: { order: "asc" },
        include: { approverEmployee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } }
      }
    },
    orderBy: [{ entityType: "asc" }, { requestType: "asc" }]
  });

  const entityNames = await resolveEntityNames(paths);
  const result = paths.map((path) => ({
    id: path.id,
    companyId: path.companyId,
    companyName: path.company.name,
    entityType: path.entityType,
    entityId: path.entityId,
    entityName: entityNames.get(path.entityId) ?? path.entityId,
    requestType: path.requestType,
    name: path.name,
    isActive: path.isActive,
    stages: path.stages.map((stage) => ({
      id: stage.id,
      order: stage.order,
      name: stage.name,
      isMandatory: stage.isMandatory,
      approverEmployeeId: stage.approverEmployeeId,
      approverLabel: `${stage.approverEmployee.firstName} ${stage.approverEmployee.lastName} (${stage.approverEmployee.employeeNumber})`
    }))
  }));

  return NextResponse.json({ success: true, paths: result });
}

type StageInput = { order: number; name?: string | null; approverEmployeeId: string; isMandatory?: boolean };

function validateStages(stages: unknown): StageInput[] {
  if (!Array.isArray(stages) || !stages.length) throw new Error("يجب إضافة مرحلة واحدة على الأقل");
  return stages.map((raw, index) => {
    const stage = raw as Record<string, unknown>;
    if (!stage.approverEmployeeId || typeof stage.approverEmployeeId !== "string") {
      throw new Error(`المرحلة رقم ${index + 1}: يجب اختيار الموظف المسؤول عن الموافقة`);
    }
    return {
      order: index + 1,
      name: typeof stage.name === "string" ? stage.name.trim() || null : null,
      approverEmployeeId: stage.approverEmployeeId,
      isMandatory: stage.isMandatory !== false
    };
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));

  try {
    if (!body.companyId) throw new Error("الشركة مطلوبة");
    if (!body.entityType) throw new Error("نوع الجهة مطلوب");
    if (!body.entityId) throw new Error("اسم الجهة مطلوب");
    if (!body.requestType || typeof body.requestType !== "string") throw new Error("نوع الطلب مطلوب");
    const stages = validateStages(body.stages);

    const path = await prisma.approvalPath.create({
      data: {
        companyId: body.companyId,
        entityType: body.entityType,
        entityId: body.entityId,
        requestType: String(body.requestType).toUpperCase().trim(),
        name: typeof body.name === "string" ? body.name.trim() || null : null,
        isActive: body.isActive !== false,
        stages: { create: stages }
      },
      include: { stages: true }
    });

    await writeAuditLog({
      actorUserId: session!.user.id as string,
      action: "approval-path:create",
      entity: "approvalPath",
      entityId: path.id,
      metadata: { companyId: body.companyId, entityType: body.entityType, entityId: body.entityId, requestType: path.requestType, stageCount: stages.length }
    });

    return NextResponse.json({ success: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل إنشاء مسار الموافقة";
    // Unique constraint: a path already exists for this exact (company, entity, requestType).
    const isDuplicate = message.includes("Unique constraint");
    return NextResponse.json({ success: false, message: isDuplicate ? "يوجد مسار موافقة بنفس الشركة والجهة ونوع الطلب مسبقاً" : message }, { status: 400 });
  }
}
