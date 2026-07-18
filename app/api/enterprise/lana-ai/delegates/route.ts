import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLanaDelegateIds, setLanaDelegateIds } from "@/lib/enterprise/lana-delegates";

function isSuperAdmin(roles: string[] | undefined) {
  return Boolean(roles?.includes("SUPER_ADMIN"));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const delegateIds = await getLanaDelegateIds();
  const employees = delegateIds.length
    ? await prisma.employee.findMany({
        where: { userId: { in: delegateIds } },
        select: { userId: true, employeeNumber: true, firstName: true, lastName: true, profilePhotoUrl: true, department: { select: { name: true } } }
      })
    : [];
  return NextResponse.json({ success: true, delegateIds, employees });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { userIds?: unknown };
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id): id is string => typeof id === "string") : [];
  const saved = await setLanaDelegateIds(session.user.id, userIds);
  return NextResponse.json({ success: true, delegateIds: saved });
}
