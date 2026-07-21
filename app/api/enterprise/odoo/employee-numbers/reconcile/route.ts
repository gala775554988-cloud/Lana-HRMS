import { NextRequest, NextResponse } from "next/server";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";
import { reconcileEmployeeNumbersAndIds } from "@/lib/integrations/odoo/employee-number-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/enterprise/odoo/employee-numbers/reconcile
 * تنفيذ المصالحة الدقيقة للأرقام الوظيفية مع أودو (وضع التطبيق الفعلي).
 * Body: { dryRun?: boolean, createMissing?: boolean, connectionId?: string }
 *
 * GET → dry-run preview مع تقرير كامل بدون أي كتابة قاعدة بيانات.
 */
export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage", request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Unauthorized" ? 401 : msg.includes("disabled") ? 412 : 403;
    return NextResponse.json({ success: false, message: msg }, { status });
  }

  let body: { dryRun?: boolean; createMissing?: boolean; connectionId?: string } = {};
  try { body = await request.json(); } catch {}

  try {
    const report = await reconcileEmployeeNumbersAndIds({
      connectionId: body.connectionId,
      dryRun: Boolean(body.dryRun),
      createMissing: body.createMissing !== false
    });

    const messageAr = report.verification.verified
      ? `✅ اكتملت مصالحة الأرقام الوظيفية مع أودو بدقة ${report.verification.exactMatchPercent}% — تم فحص ${report.odooEmployeesFetched} موظف في أودو وتحديث ${report.applied.updated} رقم وظيفي (منها ${report.matches.byOdooId + report.matches.byNationalId + report.matches.byName} مطابقة مؤكدة${report.applied.created ? ` وإنشاء ${report.applied.created} موظف جديد` : ""}). الحقل المعتمد: ${report.persistedAuthoritativeField ?? "غير محدد"}.`
      : `⚠️ اكتملت المصالحة لكن التحقق النهائي رصد ${report.verification.mismatchesRemaining} فرقاً متبقياً — راجع العينات المرفقة وأعد التشغيل.`;

    return NextResponse.json({ success: report.success, verified: report.verification.verified, message: messageAr, report });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("read", request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Unauthorized" ? 401 : msg.includes("disabled") ? 412 : 403;
    return NextResponse.json({ success: false, message: msg }, { status });
  }
  try {
    const report = await reconcileEmployeeNumbersAndIds({ dryRun: true, createMissing: true });
    return NextResponse.json({ success: report.success, preview: true, report });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
