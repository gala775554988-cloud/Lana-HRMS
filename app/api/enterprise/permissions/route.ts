import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ALL_ENTERPRISE_PERMISSIONS, PERMISSION_CATEGORIES, PERMISSION_TEMPLATES, buildPermissionTree, getPermissionStore, setUserPermissions, type PermissionKey } from "@/lib/enterprise/permissions";
import { autoHealPendingWorkflowsForEmployee } from "@/lib/enterprise/workflow";

function isSuperAdmin(roles: string[] | undefined) {
  return Boolean(roles?.includes("SUPER_ADMIN"));
}

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const store = await getPermissionStore();

  return NextResponse.json({
    success: true,
    employees: [],
    permissions: ALL_ENTERPRISE_PERMISSIONS,
    categories: PERMISSION_CATEGORIES,
    tree: buildPermissionTree(PERMISSION_CATEGORIES),
    templates: PERMISSION_TEMPLATES,
    userPermissions: store.users
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    targetUserId?: string;
    grants?: PermissionKey[];
    denies?: PermissionKey[];
    template?: keyof typeof PERMISSION_TEMPLATES;
    operation?: "replace" | "grant-all" | "remove-all" | "template" | "copy" | "reset-default";
    sourceUserId?: string;
    temporaryGrant?: { permission: PermissionKey; expiresAt: string };
  };

  if (!body.targetUserId) return NextResponse.json({ success: false, message: "targetUserId is required" }, { status: 400 });

  const store = await getPermissionStore();
  const current = store.users[body.targetUserId] ?? { grants: [], denies: [], temporaryGrants: {} };
  let grants = body.grants ?? current.grants;
  let denies = body.denies ?? current.denies;
  let temporaryGrants = current.temporaryGrants ?? {};
  const operation = body.operation ?? "replace";

  if (operation === "grant-all") grants = ALL_ENTERPRISE_PERMISSIONS;
  if (operation === "remove-all") {
    grants = [];
    denies = [];
    temporaryGrants = {};
  }
  if (operation === "template" && body.template) grants = PERMISSION_TEMPLATES[body.template] ?? grants;
  if (operation === "copy" && body.sourceUserId) grants = store.users[body.sourceUserId]?.grants ?? [];
  if (operation === "reset-default") {
    grants = [];
    denies = [];
    temporaryGrants = {};
  }
  if (body.temporaryGrant) temporaryGrants = { ...temporaryGrants, [body.temporaryGrant.permission]: body.temporaryGrant.expiresAt };

  const result = await setUserPermissions({
    actorUserId: session.user.id,
    targetUserId: body.targetUserId,
    grants,
    denies,
    temporaryGrants,
    ip: getClientIp(request),
    reason: operation
  });

  return NextResponse.json({ success: true, permissions: result });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({})) as {
      employeeId?: string;
      permissions?: string[];
      grantHospitalSupervisor?: boolean;
    };

    if (!body.employeeId) return NextResponse.json({ success: false, message: "employeeId is required" }, { status: 400 });

    const employee = await prisma.employee.findUnique({
      where: { id: body.employeeId },
      select: { id: true, userId: true, hospitalId: true, branchId: true }
    });
    if (!employee) return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });

    // 1. Update RBAC UserRole / Permission Store if userId exists
    if (employee.userId && Array.isArray(body.permissions)) {
      await setUserPermissions({
        actorUserId: session.user.id,
        targetUserId: employee.userId,
        grants: body.permissions as any[],
        denies: [],
        temporaryGrants: {},
        ip: getClientIp(request),
        reason: "AccessManagerSave"
      });
    }

    // 2. Grant/revoke hospital-supervisor status via SupervisorAssignment --
    //    this is what now actually scopes this employee's dashboard/team/
    //    approvals view to their hospital (see buildEmployeeScopeWhere).
    if (typeof body.grantHospitalSupervisor === "boolean") {
      if (body.grantHospitalSupervisor && employee.hospitalId) {
        const existing = await prisma.supervisorAssignment.findFirst({
          where: { employeeId: employee.id, entityType: "HOSPITAL", entityId: employee.hospitalId }
        });
        if (existing) {
          await prisma.supervisorAssignment.update({ where: { id: existing.id }, data: { isActive: true, endDate: null } });
        } else {
          await prisma.supervisorAssignment.create({
            data: { employeeId: employee.id, entityType: "HOSPITAL", entityId: employee.hospitalId, title: "مشرف المستشفى", startDate: new Date(), isActive: true }
          });
        }
      } else {
        await prisma.supervisorAssignment.updateMany({
          where: { employeeId: employee.id, entityType: "HOSPITAL" },
          data: { isActive: false, endDate: new Date() }
        });
      }
    }

    // 3. Trigger Auto-Heal Pipeline Engine across all PENDING workflows
    const healResult = await autoHealPendingWorkflowsForEmployee({
      employeeId: employee.id,
      hospitalId: employee.hospitalId || undefined
    });

    return NextResponse.json({
      success: true,
      message: `تم تحديث بطاقة الصلاحيات للموظف بنجاح، وإعادة توجيه (${healResult.healed}) طلب معلق إلى المرجع المعتمد الجديد تلقائياً.`,
      healedWorkflows: healResult.healed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
