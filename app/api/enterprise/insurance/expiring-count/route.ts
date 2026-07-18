import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RENEWAL_WINDOW_DAYS = 30;

/**
 * Lightweight sidebar-badge endpoint: count of ACTIVE insurance policies
 * whose endDate falls within the next RENEWAL_WINDOW_DAYS. Mirrors
 * /api/enterprise/requests/pending-count -- a single indexed COUNT query
 * (backed by InsurancePolicy_status_endDate_idx), cheap enough to poll.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  if (!hasPermission(permissions, { action: "read", resource: "insurance" }, roles)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const cutoff = new Date(Date.now() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const count = await prisma.insurancePolicy.count({
    where: { status: "ACTIVE", endDate: { lte: cutoff } }
  });

  return NextResponse.json({ success: true, count });
}
