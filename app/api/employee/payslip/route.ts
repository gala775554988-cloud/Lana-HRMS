import { latestPayslipFirst, paidPayslipRun } from "@/lib/payroll/employee-payslips";
import { NextResponse } from "next/server";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { prisma } from "@/lib/prisma";
import { buildBrandedPdf } from "@/lib/pdf/branded-pdf";

export async function GET(request: Request) {
  const employee = await getCurrentEmployeeCached();
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  
  const itemId = new URL(request.url).searchParams.get("id");
  if (itemId !== null && !itemId.trim()) return NextResponse.json({ error: "Invalid payslip ID" }, { status: 400 });
  const item = await prisma.payrollItem.findFirst({ where: { employeeId: employee.id, ...(itemId ? { id: itemId } : {}), payrollRun: paidPayslipRun }, include: { payrollRun: true }, orderBy: latestPayslipFirst });
  if (!item) return NextResponse.json({ error: "Payslip not available" }, { status: 404 });
  const snapshot = item.calculationSnapshot as { components?: { name: string; code: string; amount: number }[] } | null;
  const lines = [
    `Employee: ${employee.firstName} ${employee.lastName}`,
    `Employee Number: ${employee.employeeNumber}`,
    `Period: ${item.payrollRun.period}`,
    `Base Salary: ${Number(item.baseSalary).toFixed(2)} ${item.currency}`,
    ...(snapshot?.components ?? []).map(row => `${row.code}: ${Number(row.amount).toFixed(2)}`),
    `Gross: ${Number(item.grossPay).toFixed(2)}`,
    `Deductions: ${Number(item.deductionTotal).toFixed(2)}`,
    `Net Paid: ${Number(item.netPay).toFixed(2)}`,
  ];
  const buffer = await buildBrandedPdf("Payslip", lines);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="payslip-${employee.employeeNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
    },
  });
}
