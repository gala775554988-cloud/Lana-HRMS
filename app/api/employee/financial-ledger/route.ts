import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/employee/portal";
import { employeeFinancialSummary } from "@/lib/enterprise/employee-financial-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-service is deliberately read-only; no payments or deductions can be
// triggered through this endpoint. Employee ID comes from the session.
export async function GET(request: NextRequest) {
  const { employee } = await requireEmployee();
  const requested = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 1000000) : 1;
  const size = 25;
  const where = { employeeId: employee.id };
  const [entries, total, balances, recentExecutions] = await Promise.all([
    prisma.employeeFinancialEntry.findMany({
      where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (page - 1) * size, take: size
    }),
    prisma.employeeFinancialEntry.count({ where }),
    employeeFinancialSummary(employee.id),
    prisma.employeeRequestExecution.findMany({
      where, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, sourceType: true, sourceId: true, effectType: true, state: true, executedAt: true, createdAt: true }
    })
  ]);
  return NextResponse.json({ success: true, entries, total, balances, recentExecutions, page, pageSize: size });
}
