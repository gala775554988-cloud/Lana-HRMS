import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { prisma } from "@/lib/prisma";
import { retryMigrationRecord } from "@/lib/integrations/odoo/migration/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

// Existing migration worker re-reads one source record and upserts local data.
// It owns the per-job lease and marks errors resolved only after a successful import.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  const [open, jobs] = await Promise.all([
    prisma.odooMigrationError.count({ where: { status: "OPEN" } }),
    prisma.odooMigrationError.groupBy({ by: ["jobId"], where: { status: "OPEN" }, _count: { id: true } })
  ]);
  return NextResponse.json({ success: true, open, jobs: jobs.map(row => ({ jobId: row.jobId, open: row._count.id })) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const requested = Number(body.limit ?? 20);
  const limit = Number.isSafeInteger(requested) ? Math.min(Math.max(requested, 1), 50) : 20;
  const jobId = typeof body.jobId === "string" && body.jobId.length < 128 ? body.jobId : undefined;
  const errors = await prisma.odooMigrationError.findMany({
    where: { status: "OPEN", ...(jobId ? { jobId } : {}), job: { status: { in: ["FAILED", "COMPLETED", "COMPLETED_WITH_ERRORS", "PAUSED"] } } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, jobId: true, entity: true, externalId: true, code: true }
  });
  const results: Array<{ id: string; jobId: string; status: string; error?: string }> = [];
  for (const failure of errors) {
    try {
      await retryMigrationRecord(failure.jobId, failure.id);
      results.push({ id: failure.id, jobId: failure.jobId, status: "RESOLVED" });
    } catch (error) {
      results.push({ id: failure.id, jobId: failure.jobId, status: "OPEN", error: error instanceof Error ? error.message : String(error) });
    }
  }
  const remaining = await prisma.odooMigrationError.count({ where: { status: "OPEN", ...(jobId ? { jobId } : {}) } });
  return NextResponse.json({ success: results.every(row => row.status === "RESOLVED"), processed: results.length, resolved: results.filter(row => row.status === "RESOLVED").length, remaining, results }, { status: results.some(row => row.status !== "RESOLVED") ? 207 : 200 });
}
