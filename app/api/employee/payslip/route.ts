import { latestPayslipFirst, paidPayslipRun } from "@/lib/payroll/employee-payslips";
import { NextResponse } from "next/server";
import { getCurrentEmployeeCached } from "@/lib/employee/employee-cache";
import { prisma } from "@/lib/prisma";
import { buildPdfTable } from "@/lib/exports/table-files";

export async function GET(request: Request) {
  const employee = await getCurrentEmployeeCached();
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  
  const itemId = new URL(request.url).searchParams.get("id");
  if (itemId !== null && !itemId.trim()) return NextResponse.json({ error: "Invalid payslip ID" }, { status: 400 });
  const item = await prisma.payrollItem.findFirst({ where: { employeeId: employee.id, ...(itemId ? { id: itemId } : {}), payrollRun: paidPayslipRun }, include: { payrollRun: true }, orderBy: latestPayslipFirst });
  if (!item) return NextResponse.json({ error: "Payslip not available" }, { status: 404 });
  const snapshot = item.calculationSnapshot as { components?: { name: string; code: string; amount: number }[] } | null;
  const rows=[
    {label:"الموظف / Employee",value:employee.firstName+" "+employee.lastName},
    {label:"الرقم الوظيفي / Employee No.",value:employee.employeeNumber},
    {label:"الفترة / Period",value:item.payrollRun.period},
    {label:"العملة / Currency",value:item.currency},
    {label:"تاريخ تسجيل الصرف / Recorded payment",value:item.payrollRun.paidAt?.toISOString().slice(0,10)??""},
    ...(snapshot?.components?.length ? snapshot.components.filter(row=>Number.isFinite(Number(row.amount))&&!["GROSS","NET"].includes(row.code)).map(row=>({label:row.name+" / "+row.code,value:Number(row.amount)})) : [{label:"الأساسي / Basic",value:Number(item.baseSalary)},{label:"البدلات / Allowances",value:Number(item.allowanceTotal)},{label:"المكافآت / Bonuses",value:Number(item.bonusTotal)},{label:"الإضافي / Overtime",value:Number(item.overtimeTotal)}]),
    {label:"إجمالي الأجر / Gross",value:Number(item.grossPay)},
    {label:"إجمالي الخصومات / Deductions",value:Number(item.deductionTotal)},
    {label:"صافي الراتب / Net",value:Number(item.netPay)},
    {label:"حصة المنشأة (لا تخصم) / Employer insurance",value:Number(item.employerInsurance)}
  ];
  const buffer=await buildPdfTable("قسيمة الراتب / Payslip",[{key:"label",label:"البند / Item"},{key:"value",label:"القيمة / Value"}],rows);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="payslip-${employee.employeeNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
    },
  });
}
