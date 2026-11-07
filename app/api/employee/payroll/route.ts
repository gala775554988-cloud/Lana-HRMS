import { latestPayslipFirst, paidPayslipRun } from "@/lib/payroll/employee-payslips";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false }, { status: 403 });
  const pageInput = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(pageInput) && pageInput > 0 ? pageInput : 1;
  const paid = { employeeId: employee.id, payrollRun: paidPayslipRun };
  const [items, total, loans, advances, aggregate] = await Promise.all([
    prisma.payrollItem.findMany({ where: paid, include: { payrollRun: { select: { name: true, period: true, paidAt: true, status: true } } }, orderBy: latestPayslipFirst, take: 20, skip: (page - 1) * 20 }),
    prisma.payrollItem.count({ where: paid }),
    prisma.loan.findMany({ where: { employeeId: employee.id }, select: { id: true, loanNumber: true, principalAmount: true, outstandingAmount: true, installmentAmount: true, currency: true, issuedAt: true, status: true } }),
    prisma.employeeSalaryAdvance.findMany({ where: { employeeId: employee.id }, select: { id: true, amount: true, monthlyDeduction: true, paidInstallments: true, installments: true, startDate: true, status: true } }),
    prisma.payrollItem.groupBy({ by: ["currency"], where: paid, _sum: { netPay: true, deductionTotal: true, grossPay: true } }),
  ]);
  return NextResponse.json({ success: true, items, total, page, loans, advances, totalsByCurrency: aggregate });
}
