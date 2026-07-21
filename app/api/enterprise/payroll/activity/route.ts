import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewPayroll } from "@/lib/enterprise/payroll-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full paginated/filterable payroll activity log -- the dashboard only
 * shows the last 10 entries as a preview; this is the complete history
 * (every run's create/submit/approve/pay/cancel/lock/unlock/archive/
 * recalculate/duplicate), same AuditLog rows, just with pagination and an
 * action-type/date-range filter for audit purposes. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewPayroll(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 25), 5), 100);
  const action = searchParams.get("action") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const where: Record<string, unknown> = { entity: "payrollRun" };
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    };
  }

  const [total, entriesRaw] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, action: true, entityId: true, metadata: true, createdAt: true, actor: { select: { name: true } } }
    })
  ]);

  const runIds = Array.from(new Set(entriesRaw.map((e) => e.entityId).filter(Boolean))) as string[];
  const runs = runIds.length
    ? await prisma.payrollRun.findMany({ where: { id: { in: runIds } }, select: { id: true, name: true, period: true } })
    : [];
  const runById = new Map(runs.map((r) => [r.id, r]));

  const entries = entriesRaw.map((entry) => ({
    id: entry.id,
    action: entry.action,
    runId: entry.entityId,
    runName: entry.entityId ? runById.get(entry.entityId)?.name ?? null : null,
    runPeriod: entry.entityId ? runById.get(entry.entityId)?.period ?? null : null,
    actorName: entry.actor?.name ?? "النظام",
    createdAt: entry.createdAt,
    metadata: entry.metadata
  }));

  return NextResponse.json({ success: true, entries, total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) });
}
