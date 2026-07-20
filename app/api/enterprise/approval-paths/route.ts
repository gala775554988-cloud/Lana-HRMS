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
    const entityIds: string[] = Array.isArray(body.entityIds) && body.entityIds.length > 0
      ? body.entityIds.filter((id: any) => typeof id === "string" && id.trim())
      : (body.entityId ? [body.entityId] : []);
    const requestTypes: string[] = Array.isArray(body.requestTypes) && body.requestTypes.length > 0
      ? body.requestTypes.filter((t: any) => typeof t === "string" && t.trim())
      : (body.requestType ? [body.requestType] : []);

    if (!body.companyId) throw new Error("الشركة مطلوبة");
    if (!body.entityType) throw new Error("نوع الجهة مطلوب");
    if (!entityIds.length) throw new Error("يجب اختيار جهة واحدة أو أكثر");
    if (!requestTypes.length) throw new Error("يجب اختيار نوع طلب واحد أو أكثر");
    const stages = validateStages(body.stages);

    const createdPaths = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const eId of entityIds) {
        for (const rType of requestTypes) {
          const normalizedReqType = String(rType).toUpperCase().trim();
          const upserted = await tx.approvalPath.upsert({
            where: {
              companyId_entityType_entityId_requestType: {
                companyId: body.companyId,
                entityType: body.entityType,
                entityId: eId,
                requestType: normalizedReqType
              }
            },
            update: {
              name: typeof body.name === "string" ? body.name.trim() || null : null,
              isActive: body.isActive !== false,
              stages: {
                deleteMany: {},
                create: stages
              }
            },
            create: {
              companyId: body.companyId,
              entityType: body.entityType,
              entityId: eId,
              requestType: normalizedReqType,
              name: typeof body.name === "string" ? body.name.trim() || null : null,
              isActive: body.isActive !== false,
              stages: { create: stages }
            },
            include: { stages: true }
          });
          results.push(upserted);
        }
      }
      return results;
    });

    await writeAuditLog({
      actorUserId: session!.user.id as string,
      action: "approval-path:create-multi",
      entity: "approvalPath",
      entityId: createdPaths[0]?.id || "multi",
      metadata: { companyId: body.companyId, entityType: body.entityType, entityIds, requestTypes, stageCount: stages.length, createdCount: createdPaths.length }
    });

    return NextResponse.json({ success: true, path: createdPaths[0], createdCount: createdPaths.length, paths: createdPaths });
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل إنشاء مسار الموافقة";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
