import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { getSocialInsuranceStats } from "@/lib/enterprise/social-insurance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  const allowed = roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action: "read", resource: "social-insurance" }, roles);
  if (!allowed || !isEnterpriseResourceAllowed(roles, "social-insurance")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const stats = await getSocialInsuranceStats();
  return NextResponse.json({ success: true, stats });
}
