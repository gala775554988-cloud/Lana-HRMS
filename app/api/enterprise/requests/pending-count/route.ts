import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight sidebar-badge endpoint: count of request workflows currently
 * waiting on THIS user as approver. Deliberately separate from the full
 * GET /api/enterprise/requests (which loads up to 5000 rows to compute
 * page data/stats) -- this is a single indexed COUNT query, cheap enough
 * to poll every few seconds from the sidebar.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const count = await prisma.workflowInstance.count({
    where: { status: "PENDING", steps: { some: { approverUserId: session.user.id, status: "PENDING" } } }
  });

  return NextResponse.json({ success: true, count });
}
