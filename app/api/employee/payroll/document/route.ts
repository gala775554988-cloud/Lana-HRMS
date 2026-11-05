import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppSetting } from "@/lib/settings";
import { payrollDocument } from "@/lib/payroll/document";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const item = await prisma.payrollItem.findFirst({ where: { id: params.get("id") ?? "", employee: { userId: session.user.id }, payrollRun: { status: { in: ["PAID", "LOCKED", "ARCHIVED"] }, paidAt: { not: null } } }, include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, nationality: { select: { code: true } } } }, payrollRun: true } });
  if (!item) return NextResponse.json({ success: false, message: "القسيمة غير متاحة" }, { status: 404 });
  const certificate = params.get("kind") === "certificate";
  const detailed = params.get("details") !== "0";
  const recipient = (params.get("recipient") ?? "إلى من يهمه الأمر").slice(0, 200);
  if (certificate && !await prisma.letterRequest.findFirst({ where: { employeeId: item.employeeId, status: "APPROVED", letterType: "salary" } })) return NextResponse.json({ success: false, message: "قدّم طلب تعريف بالراتب عبر الخدمات الذاتية وانتظر الاعتماد" }, { status: 409 });
  const [company, signature, signatory] = await Promise.all([getAppSetting("company.name"), getAppSetting("payroll.certificateSignatureDataUrl"), getAppSetting("payroll.certificateSignatory")]);
  const snapshot = item.calculationSnapshot as { components?: { code: string; name: string; amount: number; kind: string }[]; gosi?: { employeeRate?: number; employerRate?: number; subjectWage?: number } } | null;
  const rows: { label: string; value: unknown }[] = [{ label: "الراتب الأساسي", value: Number(item.baseSalary).toFixed(2) }];
  if (detailed) {
    const components = snapshot?.components?.filter(row => !["BASIC", "GROSS", "NET", "EMPLOYER", "INFORMATION"].includes(row.kind) && row.code !== "BASIC" && (!certificate || ["ALLOWANCE", "EARNING"].includes(row.kind))) ?? [];
    rows.push(...components.map(row => ({ label: `${row.name} (${row.code})`, value: Number(row.amount).toFixed(2) })));
    if (!components.length) rows.push({ label: "البدلات", value: Number(item.allowanceTotal).toFixed(2) });
  }
  if (!certificate) {
    rows.push({ label: "الإجمالي", value: Number(item.grossPay).toFixed(2) }, { label: "إجمالي الاستقطاعات", value: Number(item.deductionTotal).toFixed(2) }, { label: "صافي المصروف", value: Number(item.netPay).toFixed(2) });
    if (["SA", "SAU", "SAUDI"].includes(item.employee.nationality?.code.toUpperCase() ?? "") && snapshot?.gosi?.employeeRate != null) rows.push({ label: "الأجر الخاضع للتأمينات", value: snapshot.gosi.subjectWage }, { label: "نسبة الموظف %", value: snapshot.gosi.employeeRate }, { label: "نسبة المنشأة %", value: snapshot.gosi.employerRate }, { label: "حصة المنشأة (لا تخصم من الموظف)", value: Number(item.employerInsurance).toFixed(2) });
  }
  const reference = `LANA-${certificate ? "CERT" : "PAY"}-${item.id}`;
  const qr = await QRCode.toDataURL(reference, { width: 160, margin: 1 });
  await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: certificate ? "payroll:certificate" : "payroll:payslip-view", entity: "payrollItem", entityId: item.id, metadata: { detailed, recipient: certificate ? recipient : null } } });
  return new NextResponse(payrollDocument({ title: certificate ? "تعريف بالراتب" : "قسيمة الراتب التفصيلية", company: typeof company === "string" ? company : "LANA HRMS", employee: `${item.employee.firstName} ${item.employee.lastName}`, number: item.employee.employeeNumber, period: item.payrollRun.period, currency: item.currency, rows, qr, reference, recipient: certificate ? recipient : undefined, signature: certificate && typeof signature === "string" ? signature : undefined, signatory: typeof signatory === "string" ? signatory : undefined }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" } });
}
