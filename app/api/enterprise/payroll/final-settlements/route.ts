import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { finalSettlementInput, makeFinalSettlementSnapshot } from "@/lib/payroll/final-settlement";
import { advanceSchedule } from "@/lib/payroll/calculations";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return response({success:false},401);
  if (!canApprovePayroll(session)) return response({success:false},403);
  const records = await prisma.employeeFinalSettlement.findMany({take:50, orderBy:{createdAt:"desc"}, include:{employee:{select:{employeeNumber:true,firstName:true,lastName:true}}}});
  return response({success:true,records});
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return response({success:false},401);
  if (!canApprovePayroll(session)) return response({success:false},403);
  const parsed = finalSettlementInput.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return response({success:false,message:"راجع المدخلات وسبب الاستحقاق وملاحظة المراجعة"},400);
  try {
    const record = await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({where:{employeeNumber:parsed.data.employeeNumber},select:{id:true,hireDate:true,terminationDate:true}});
      if (!employee?.terminationDate) throw new Error("يلزم وجود تاريخ انتهاء خدمة موثق في ملف الموظف");
      const [loans,advances] = await Promise.all([
        tx.loan.findMany({where:{employeeId:employee.id,status:"ACTIVE"},select:{currency:true,outstandingAmount:true}}),
        tx.employeeSalaryAdvance.findMany({where:{employeeId:employee.id,status:"APPROVED"}})
      ]);
      if (loans.some(row=>row.currency!=="SAR")) throw new Error("تحتاج القروض بعملة أخرى إلى تسوية معتمدة قبل المخالصة");
      const debt = loans.reduce((sum,row)=>sum+Number(row.outstandingAmount),0) + advances.reduce((sum,row)=>sum+advanceSchedule({amount:Number(row.amount),monthlyDeduction:Number(row.monthlyDeduction),installments:row.installments,paidInstallments:row.paidInstallments}).remaining,0);
      const snapshot = makeFinalSettlementSnapshot(parsed.data,employee.hireDate,employee.terminationDate,debt);
      const record = await tx.employeeFinalSettlement.create({data:{employeeId:employee.id,terminationDate:employee.terminationDate,createdById:session.user.id,snapshot,netAmount:snapshot.totals.netSettlement}});
      await tx.auditLog.create({data:{actorUserId:session.user.id,action:"final-settlement:draft",entity:"employeeFinalSettlement",entityId:record.id,metadata:{employeeId:employee.id,netAmount:String(record.netAmount)}}});
      return record;
    },{isolationLevel:"Serializable"});
    return response({success:true,record},201);
  } catch(error) {
    if(error instanceof Prisma.PrismaClientKnownRequestError) return response({success:false,message:"توجد مخالصة لنفس تاريخ الانتهاء أو تعارض في البيانات"},409);
    return response({success:false,message:error instanceof Error?error.message:"تعذر إعداد المخالصة"},409);
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return response({success:false},401);
  if (!canApprovePayroll(session)) return response({success:false},403);
  const body = await request.json().catch(()=>null);
  if(typeof body?.id!=="string" || !["approve","cancel"].includes(body?.action)) return response({success:false,message:"الإجراء غير صالح"},400);
  try {
    const record = await prisma.$transaction(async tx=>{
      const old = await tx.employeeFinalSettlement.findUnique({where:{id:body.id}});
      if(!old || old.status!=="DRAFT") throw new Error("المخالصة ليست مسودة");
      if(body.action==="approve" && old.createdById===session.user.id) throw new Error("اعتماد المخالصة يحتاج مراجعاً آخر");
      const now=new Date();
      const changed=await tx.employeeFinalSettlement.updateMany({where:{id:old.id,status:"DRAFT",updatedAt:old.updatedAt},data:body.action==="approve"?{status:"APPROVED",approvedById:session.user.id,approvedAt:now}:{status:"CANCELLED"}});
      if(changed.count!==1) throw new Error("تغيرت المخالصة أثناء المراجعة");
      await tx.auditLog.create({data:{actorUserId:session.user.id,action:"final-settlement:"+body.action,entity:"employeeFinalSettlement",entityId:old.id,metadata:{employeeId:old.employeeId,netAmount:String(old.netAmount),paymentExecuted:false}}});
      if(body.action==="approve") await tx.employeeRequestExecution.create({data:{employeeId:old.employeeId,sourceType:"FINAL_SETTLEMENT",sourceId:old.id,effectType:"APPROVAL_RECORDED",state:"EXECUTED",executedAt:now,metadata:{netAmount:String(old.netAmount),paymentConfirmed:false}}});
      return tx.employeeFinalSettlement.findUniqueOrThrow({where:{id:old.id}});
    },{isolationLevel:"Serializable"});
    return response({success:true,record});
  } catch(error) {return response({success:false,message:error instanceof Prisma.PrismaClientKnownRequestError?"تعارض في البيانات؛ حدّث الصفحة":error instanceof Error?error.message:"تعذر التنفيذ"},409);}
}
