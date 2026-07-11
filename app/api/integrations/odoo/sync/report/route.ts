import { NextRequest, NextResponse } from "next/server";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage");
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get("entity") || "employees";
    const limit = Number(searchParams.get("limit") || 5);

    const histories = await prisma.syncHistory.findMany({
      where: entity !== "all" ? { entity } : {},
      orderBy: { finishedAt: "desc" },
      take: limit,
    });

    const logs = await prisma.integrationLog.findMany({
      where: {
        action: { in: ["ODOO_EMPLOYEE_SKIP", "ODOO_FETCH_ERROR", "ODOO_EMPLOYEE_FIXED", "ODOO_CONTRACT_SKIP", "ODOO_SYNC", "ODOO_SYNC_FAILED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalEmployees = await prisma.employee.count().catch(() => 0);

    const latest = histories[0];
    const latestMeta = (latest?.metadata as any) || {};
    const report = {
      // آخر مزامنة
      latestSync: latest ? {
        id: latest.id,
        entity: latest.entity,
        status: latest.status,
        pulled: latest.pulled,
        created: latest.createdCount,
        updated: latest.updatedCount,
        skipped: latestMeta?.skipped || 0,
        startedAt: latest.startedAt,
        finishedAt: latest.finishedAt,
        cursor: latest.cursor,
        metadata: latest.metadata,
      } : null,
      // عدد الموظفين
      totalEmployeesInLana: totalEmployees,
      // الأخطاء
      errors: latestMeta?.errors || latestMeta?.report?.errorsList || [],
      errorsCount: latestMeta?.errorsCount || latestMeta?.skipped || 0,
      // skipped
      skipped: latestMeta?.skipped || 0,
      // lastOdooId
      lastOdooId: latestMeta?.lastOdooId || 0,
      lastWriteDate: latestMeta?.lastWriteDate || latest?.cursor,
      // آخر صفحة
      lastPage: latestMeta?.page || latestMeta?.pages || 0,
      pages: latestMeta?.pages || latestMeta?.page || 0,
      // SyncHistory كامل
      syncHistory: latest,
      histories: histories.map(h => ({
        id: h.id,
        entity: h.entity,
        status: h.status,
        pulled: h.pulled,
        created: h.createdCount,
        updated: h.updatedCount,
        finishedAt: h.finishedAt,
        error: h.error,
        metadata: h.metadata,
      })),
      recentErrorLogs: logs.filter(l => l.level === "ERROR" || l.action.includes("SKIP")).slice(0, 100).map(l => ({
        action: l.action,
        message: l.message,
        level: l.level,
        createdAt: l.createdAt,
        response: l.response,
      })),
      summary: latestMeta?.report || latestMeta || null,
      // تقرير نهائي مطابق للمطلوب { pulled, created, updated, skipped, errors }
      finalReport: latest ? {
        pulled: latest.pulled,
        created: latest.createdCount,
        updated: latest.updatedCount,
        skipped: latestMeta?.skipped || 0,
        errors: latestMeta?.errors || [],
      } : null,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: statusFor(error) });
  }
}
