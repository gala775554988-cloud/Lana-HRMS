import { NextResponse } from "next/server";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { getPayrollSummary } from "@/lib/employee/data";
import { buildBrandedPdf } from "@/lib/pdf/branded-pdf";

export async function GET() {
  const employee = await getCurrentEmployeeCached();
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  
  const salary = await getPayrollSummary(employee.id).catch(() => null);
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const lines = [
    `Employee: ${fullName}`,
    `Employee Number: ${employee.employeeNumber}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Base Salary: ${salary?.baseSalary ?? "0"}`,
    `Currency: ${salary?.currency ?? "SAR"}`,
    `Net Pay: ${salary?.netPay ?? salary?.baseSalary ?? "0"}`,
    `Last Pay Date: ${salary?.lastPayDate ?? "Not recorded"}`,
  ];
  const buffer = await buildBrandedPdf("Payslip", lines);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${employee.employeeNumber}.pdf"`,
    },
  });
}
