import { NextResponse } from "next/server";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { getPayrollSummary } from "@/lib/employee/data";

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");
}

function buildPdf(lines: string[]) {
  const stream = ["BT", "/F1 12 Tf", "50 780 Td", ...lines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, "0 -18 Td"]), "ET"].join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(Buffer.byteLength(pdf)); pdf += object; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

export async function GET() {
  const employee = await getCurrentEmployeeCached();
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const salary = await getPayrollSummary(employee.id).catch(() => null);
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const lines = [
    "Lana HRMS Payslip",
    `Employee: ${fullName}`,
    `Employee Number: ${employee.employeeNumber}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Base Salary: ${salary?.baseSalary ?? "0"}`,
    `Currency: ${salary?.currency ?? "SAR"}`,
    `Net Pay: ${salary?.netPay ?? salary?.baseSalary ?? "0"}`,
    `Last Pay Date: ${salary?.lastPayDate ?? "Not recorded"}`, 
  ];
  return new NextResponse(buildPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${employee.employeeNumber}.pdf"`,
    },
  });
}
