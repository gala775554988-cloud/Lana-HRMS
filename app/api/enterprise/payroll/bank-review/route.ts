import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { buildBankReviewCsv } from "@/lib/payroll/calculations";
import { inspectBankReview } from "@/lib/payroll/bank-preflight";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  const id = new URL(request.url).searchParams.get("runId") ?? "";
  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { items: { include: { employee: { select: { employeeNumber: true, companyId:true, bankAccounts: { where: { isPrimary: true } } } } } } } });
  if (!run || !["APPROVED", "PAID", "LOCKED"].includes(run.status)) return NextResponse.json({ success: false, message: "المسير غير معتمد" }, { status: 409 });
  try {
    const rows=run.items.map(item=>({employeeNumber:item.employee.employeeNumber,iban:item.employee.bankAccounts[0]?.iban??"",primaryAccounts:item.employee.bankAccounts.length,companyId:item.employee.companyId,gross:Number(item.grossPay),deductions:Number(item.deductionTotal),net:Number(item.netPay),currency:item.currency}));
    const companyId=run.companyId??(new Set(rows.map(row=>row.companyId)).size===1?rows[0]?.companyId??null:null);
    const review=inspectBankReview(rows,companyId);
    if(new URL(request.url).searchParams.get("mode")==="validate")return NextResponse.json({success:true,review},{headers:{"Cache-Control":"private, no-store"}});
    if(!review.ready)return NextResponse.json({success:false,message:"توجد أخطاء في مراجعة الملف المصرفي",review},{status:422,headers:{"Cache-Control":"private, no-store"}});
    if(review.issues.some(issue=>issue.severity==="WARNING")&&new URL(request.url).searchParams.get("reviewWarnings")!=="true")return NextResponse.json({success:false,message:"راجع التنبيهات أولاً",review},{status:409,headers:{"Cache-Control":"private, no-store"}});
    const csv = buildBankReviewCsv(run.items.map(item => {
      if (item.employee.bankAccounts.length !== 1) throw new Error(`حدد حساباً بنكياً رئيسياً واحداً للموظف ${item.employee.employeeNumber}`);
      return { employeeNumber: item.employee.employeeNumber, iban: item.employee.bankAccounts[0].iban, currency: item.currency, net: Number(item.netPay) };
    }));
    await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:bank-review-export", entity: "payrollRun", entityId: id, metadata:{documentType:"INTERNAL_BANK_REVIEW",count:review.count,netTotal:review.netTotal,warningCount:review.issues.length} } });
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="internal-bank-review-not-wps.csv"', "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 }); }
}
