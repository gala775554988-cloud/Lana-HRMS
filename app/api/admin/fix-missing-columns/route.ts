import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnoses and, on POST, repairs the four columns reported missing in
// production (PrismaClientKnownRequestError "column does not exist" on
// Notification.link, PayrollItem.bonusTotal, LeaveType.genderRestriction,
// OvertimeRequest.amount) despite all four already being defined in
// schema.prisma, versioned migrations, and scripts/ensure-db-schema.mjs's
// vercel-build auto-heal list. Uses the app's own `prisma` singleton (the
// exact connection the failing runtime queries use) instead of a raw
// DATABASE_URL, so a clean result here proves the fix actually reached the
// database serving real traffic -- not just some other Neon branch/URL the
// build-time script might have connected to instead.
const TARGETS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "Notification", column: "link", ddl: `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;` },
  { table: "PayrollItem", column: "bonusTotal", ddl: `ALTER TABLE "PayrollItem" ADD COLUMN IF NOT EXISTS "bonusTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;` },
  { table: "LeaveType", column: "genderRestriction", ddl: `ALTER TABLE "LeaveType" ADD COLUMN IF NOT EXISTS "genderRestriction" TEXT;` },
  { table: "OvertimeRequest", column: "amount", ddl: `ALTER TABLE "OvertimeRequest" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2);` },
];

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, status: 401, message: "Unauthorized" };
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) return { ok: false as const, status: 403, message: "Forbidden" };
  return { ok: true as const };
}

async function checkColumns() {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND (table_name, column_name) IN (${TARGETS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")})`,
    ...TARGETS.flatMap((t) => [t.table, t.column])
  );
  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  return TARGETS.map((t) => ({ table: t.table, column: t.column, exists: present.has(`${t.table}.${t.column}`) }));
}

export async function GET() {
  const authCheck = await requireSuperAdmin();
  if (!authCheck.ok) return NextResponse.json({ success: false, message: authCheck.message }, { status: authCheck.status });

  try {
    const status = await checkColumns();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST() {
  const authCheck = await requireSuperAdmin();
  if (!authCheck.ok) return NextResponse.json({ success: false, message: authCheck.message }, { status: authCheck.status });

  const results: Array<{ table: string; column: string; success: boolean; message?: string }> = [];
  for (const target of TARGETS) {
    try {
      await prisma.$executeRawUnsafe(target.ddl);
      results.push({ table: target.table, column: target.column, success: true });
    } catch (error) {
      results.push({ table: target.table, column: target.column, success: false, message: error instanceof Error ? error.message : String(error) });
    }
  }

  try {
    const status = await checkColumns();
    return NextResponse.json({ success: results.every((r) => r.success), results, status });
  } catch (error) {
    return NextResponse.json({ success: false, results, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
