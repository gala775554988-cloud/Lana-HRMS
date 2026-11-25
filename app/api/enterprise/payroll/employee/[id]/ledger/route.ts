import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewPayroll } from "@/lib/enterprise/payroll-permissions";
import { applyScopedWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { employeeFinancialSummary } from "@/lib/enterprise/employee-financial-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canViewPayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  const { id } = await params;
  const scope = await applyScopedWhere("employees", {}, await getAccessProfile(session.user.id, session.user.roles ?? []));
  const employee = await prisma.employee.findFirst({ where: { AND: [scope, { id }] }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false }, { status: 404 });
  const requested = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 1000000) : 1;
  const size = 30;
  const where = { employeeId: id };
  const [entries, count, balances, executions] = await Promise.all([
    prisma.employeeFinancialEntry.findMany({
      where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (page - 1) * size, take: size
    }),
    prisma.employeeFinancialEntry.count({ where }),
    employeeFinancialSummary(id),
    prisma.employeeRequestExecution.findMany({
      where, orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, sourceType: true, sourceId: true, effectType: true, state: true, executedAt: true, createdAt: true }
    })
  ]);
  return NextResponse.json({ success: true, employeeId: id, entries, count, balances, executions, page, pageSize: size },
    { headers: { "Cache-Control": "private, no-store" } });
}
