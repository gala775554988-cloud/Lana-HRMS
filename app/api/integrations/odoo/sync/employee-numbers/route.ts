import { NextRequest, NextResponse } from "next/server";
import { reconcileEmployeeNumbersAndIds } from "@/lib/integrations/odoo/employee-number-reconcile";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

/**
 * Compatibility endpoint used by the legacy employee-number sync button.
 * Odoo's internal hr.employee.id is never accepted as an employee number.
 */
export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage", request);
    const body = await request.json().catch(() => ({}));
    const report = await reconcileEmployeeNumbersAndIds({
      connectionId: typeof body.connectionId === "string" ? body.connectionId : undefined,
      dryRun: Boolean(body.dryRun),
      createMissing: body.createMissing !== false,
      timeBudgetMs: Math.min(Math.max(Number(body.timeBudgetMs ?? 240_000), 30_000), 280_000),
    });

    const complete = report.success
      && !report.incomplete
      && report.noOdooNumber === 0
      && report.verification.verified
      && report.verification.mismatchesRemaining === 0;

    return NextResponse.json({
      success: report.success,
      complete,
      verified: report.verification.verified,
      source: report.persistedAuthoritativeField,
      message: complete
        ? `اكتملت مطابقة الأرقام الوظيفية من حقل Odoo المعتمد (${report.persistedAuthoritativeField}) بنسبة 100%.`
        : report.message,
      report,
    }, { status: report.success ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { success: false, complete: false, message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
