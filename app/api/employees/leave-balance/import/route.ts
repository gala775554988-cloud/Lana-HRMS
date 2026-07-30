import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { applyLeaveCsvImport, planLeaveCsvImport } from "@/lib/employee/leave-csv-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!hasAnyRole(session, ["SUPER_ADMIN", "HR_MANAGER"])) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const csv = typeof body.csv === "string" ? body.csv : "";
    const apply = body.apply === true;
    if (!csv.trim()) return NextResponse.json({ success: false, message: "CSV content is required" }, { status: 400 });

    const plan = await planLeaveCsvImport(csv);
    const summary = {
      totalRows: plan.totalRows,
      matched: plan.planned.length,
      skipped: plan.skipped.length,
      skippedRows: plan.skipped.slice(0, 100),
    };
    if (!apply) return NextResponse.json({ success: true, dryRun: true, ...summary });
    if (plan.skipped.length) {
      return NextResponse.json({ success: false, message: "Import blocked: CSV has unmatched or invalid rows", ...summary }, { status: 422 });
    }

    await applyLeaveCsvImport(plan.planned, "الاجازات_المستحقه (1).csv");
    await writeAuditLog({
      actorUserId: session.user.id,
      action: "leave-balance:csv-import",
      entity: "EmployeeLeaveBalance",
      metadata: summary,
    });
    return NextResponse.json({ success: true, applied: true, ...summary });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
