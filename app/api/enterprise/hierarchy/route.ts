import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getHierarchyStore, saveHierarchyStore, type HierarchyStore } from "@/lib/enterprise/hierarchy";
import { writeAuditLog } from "@/lib/audit";

function isSuperAdmin(roles: string[] | undefined) {
  return Boolean(roles?.includes("SUPER_ADMIN"));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const [store, employees, branches, departments, positions] = await Promise.all([
    getHierarchyStore(),
    prisma.employee.findMany({
      select: { id: true, employeeNumber: true, firstName: true, lastName: true, userId: true, branchId: true, departmentId: true, positionId: true, managerId: true, manager: { select: { firstName: true, lastName: true, employeeNumber: true } }, branch: { select: { name: true } }, department: { select: { name: true } }, position: { select: { title: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 1000
    }),
    prisma.branch.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ select: { id: true, title: true, code: true, departmentId: true }, orderBy: { title: "asc" } })
  ]);

  return NextResponse.json({ success: true, store, employees, branches, departments, positions, company: { name: "Lana HRMS" } });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json() as { store?: HierarchyStore };
  if (!body.store) return NextResponse.json({ success: false, message: "store is required" }, { status: 400 });
  const saved = await saveHierarchyStore({
    version: 1,
    directManagers: body.store.directManagers ?? {},
    departmentManagers: body.store.departmentManagers ?? {},
    branchManagers: body.store.branchManagers ?? {},
    hrManagers: body.store.hrManagers ?? [],
    projects: body.store.projects ?? {}
  });
  await writeAuditLog({ actorUserId: session.user.id, action: "hierarchy:update", entity: "appSetting", entityId: saved.id, metadata: { key: "enterprise.hierarchy" } });
  return NextResponse.json({ success: true, store: saved.value });
}
