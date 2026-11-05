import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { buildBankReviewCsv } from "@/lib/payroll/calculations";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  const id = new URL(request.url).searchParams.get("runId") ?? "";
  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { items: { include: { employee: { select: { employeeNumber: true, bankAccounts: { where: { isPrimary: true } } } } } } } });
  if (!run || !["APPROVED", "PAID", "LOCKED"].includes(run.status)) return NextResponse.json({ success: false, message: "المسير غير معتمد" }, { status: 409 });
  try {
    const csv = buildBankReviewCsv(run.items.map(item => {
      if (item.employee.bankAccounts.length !== 1) throw new Error(`حدد حساباً بنكياً رئيسياً واحداً للموظف ${item.employee.employeeNumber}`);
      return { employeeNumber: item.employee.employeeNumber, iban: item.employee.bankAccounts[0].iban, currency: item.currency, net: Number(item.netPay) };
    }));
    await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:bank-review-export", entity: "payrollRun", entityId: id } });
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="payroll-bank-review.csv"', "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 }); }
}
