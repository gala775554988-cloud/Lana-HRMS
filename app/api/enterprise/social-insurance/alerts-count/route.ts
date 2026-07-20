import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Backs the sidebar "التأمينات الاجتماعية" badge -- active employees with
// no GOSI registration at all (no record, or a record still sitting at
// NOT_REGISTERED). Mirrors the insurance module's expiring-count endpoint.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const allowed = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "social-insurance" }, roles);
  if (!allowed) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const count = await prisma.employee.count({
    where: {
      status: "ACTIVE",
      OR: [{ socialInsuranceRecord: null }, { socialInsuranceRecord: { status: "NOT_REGISTERED" } }]
    }
  });

  return NextResponse.json({ success: true, count });
}
