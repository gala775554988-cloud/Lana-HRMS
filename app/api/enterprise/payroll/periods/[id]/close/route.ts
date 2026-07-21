import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Closing a period is the final step of section 8's workflow ("إغلاق
 * الفترة") -- distinct from paying an individual run, since a period can
 * have more than one run (different branches/cost centers). Every run tied
 * to the period must already be PAID or CANCELLED before it can close, and
 * once closed it's a hard stop: no further runs may be created against it
 * (enforced by the run-creation route rejecting a non-DRAFT reuse of the
 * same `period` string, combined with this period's own CLOSED status
 * being checked by the UI before offering "create run" for it again). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id }, include: { runs: { select: { id: true, status: true, name: true } } } });
  if (!period) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  if (period.status === "CLOSED") return NextResponse.json({ success: false, message: "الفترة مغلقة بالفعل" }, { status: 409 });

  const unsettled = period.runs.filter((run) => !["PAID", "CANCELLED", "LOCKED", "ARCHIVED"].includes(run.status));
  if (unsettled.length > 0) {
    return NextResponse.json({
      success: false,
      message: `لا يمكن إغلاق الفترة -- ${unsettled.length} مسير رواتب لم يُصرف بعد`,
      unsettledRuns: unsettled
    }, { status: 409 });
  }

  const updated = await prisma.payrollPeriod.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date(), closedById: session.user.id }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "close",
    entity: "payrollPeriod",
    entityId: id,
    metadata: { runCount: period.runs.length }
  });

  return NextResponse.json({ success: true, period: updated });
}
