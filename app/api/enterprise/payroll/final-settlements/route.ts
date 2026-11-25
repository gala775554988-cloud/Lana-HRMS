import type { AppTransaction } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { finalSettlementInput, makeFinalSettlementSnapshot, settlementPaymentInput, settlementDebtSnapshot, buildFinalSettlementEntries, calculateLeaveEncashment, reconcileOdooSettlementInstallments } from "@/lib/payroll/final-settlement";
import { requireLegacyDebtReview } from "@/lib/payroll/debt-review";
import { advanceSchedule, money } from "@/lib/payroll/calculations";
import { Prisma } from "@prisma/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });


async function readSources(tx: AppTransaction, employeeId:string) {
  const [loans,advances,leave,paid] = await Promise.all([
    tx.loan.findMany({where:{employeeId,status:"ACTIVE",OR:[{disbursementRequired:false},{disbursedAt:{not:null}}]},orderBy:{id:"asc"},include:{repaymentSchedule:true}}),
    tx.employeeSalaryAdvance.findMany({where:{employeeId,status:"APPROVED",OR:[{disbursementRequired:false},{disbursedAt:{not:null}}]},orderBy:{id:"asc"}}),
    tx.employeeLeaveBalance.findUnique({where:{employeeId},select:{accrued:true,used:true,updatedAt:true}}),
    tx.payrollItem.findFirst({where:{employeeId,payrollRun:{paidAt:{not:null}}},orderBy:[{payrollRun:{paidAt:"desc"}},{id:"desc"}],select:{id:true,payrollRun:{select:{paidAt:true}}}})
  ]);
  await requireLegacyDebtReview(tx,[
    ...loans.filter(l=>!l.odooSource&&!l.disbursementRequired&&!l.disbursedAt&&Number(l.outstandingAmount)>0).map(l=>({sourceType:"LOAN" as const,sourceId:l.id,employeeId:l.employeeId,principal:l.principalAmount,currency:l.currency})),
    ...advances.filter(a=>!a.disbursementRequired&&!a.disbursedAt&&a.paidInstallments<a.installments).map(a=>({sourceType:"ADVANCE" as const,sourceId:a.id,employeeId:a.employeeId,principal:a.amount,currency:"SAR"}))
  ]);
  if(loans.some(row=>row.currency!=="SAR"))throw Error("تحتاج القروض بعملة أخرى إلى تسوية معتمدة");
  const debtSources=[
    ...loans.map(row=>({kind:"LOAN" as const,id:row.id,amount:Number(row.outstandingAmount),version:row.updatedAt.toISOString(),external:!!row.odooSource,...(row.odooSource?{installmentIds:reconcileOdooSettlementInstallments(Number(row.outstandingAmount),row.repaymentSchedule.map(line=>({...line,amount:Number(line.amount)})))}:{})})),
    ...advances.map(row=>({kind:"ADVANCE" as const,id:row.id,amount:advanceSchedule({amount:Number(row.amount),monthlyDeduction:Number(row.monthlyDeduction),installments:row.installments,paidInstallments:row.paidInstallments}).remaining,version:row.updatedAt.toISOString(),external:false}))
  ];
  return {debtSources,leaveVersion:leave?JSON.stringify([String(leave.accrued),String(leave.used),leave.updatedAt.toISOString()]):null,lastPaidVersion:paid?paid.id+":"+paid.payrollRun.paidAt?.toISOString():null,leaveDays:leave?money(Math.max(0,Number(leave.accrued)-Number(leave.used))):undefined};
}
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
      const sources=await readSources(tx,employee.id);
      const debt=money(sources.debtSources.reduce((sum,row)=>sum+row.amount,0));
      const balance=await tx.employeeLeaveBalance.findUnique({where:{employeeId:employee.id}});
      const encash=parsed.data.encashRemainingLeave?calculateLeaveEncashment(balance?{accrued:Number(balance.accrued),used:Number(balance.used)}:null,parsed.data.monthlyWage):{days:0,amount:0};
      if(!parsed.data.encashRemainingLeave && parsed.data.leaveEncashment!==0)throw Error("استخدم رصيد الإجازات الموثق بدلاً من إدخال مبلغ يدوي");
      const snapshot = {...makeFinalSettlementSnapshot({...parsed.data,leaveEncashment:encash.amount},employee.hireDate,employee.terminationDate,debt),...sources,encashedDays:encash.days};
      const existing=await tx.employeeFinalSettlement.findUnique({where:{employeeId_terminationDate:{employeeId:employee.id,terminationDate:employee.terminationDate}}});
      if(existing && !["DRAFT","CANCELLED"].includes(existing.status))throw Error("توجد مخالصة معتمدة أو مؤكدة لنفس التاريخ");
      if(existing)await tx.auditLog.create({data:{actorUserId:session.user.id,action:"final-settlement:revision",entity:"employeeFinalSettlement",entityId:existing.id,metadata:{previousSnapshot:existing.snapshot,previousStatus:existing.status}}});
      const record=existing?await tx.employeeFinalSettlement.update({where:{id:existing.id},data:{status:"DRAFT",createdById:session.user.id,snapshot,netAmount:snapshot.totals.netSettlement,approvedById:null,approvedAt:null}}):await tx.employeeFinalSettlement.create({data:{employeeId:employee.id,terminationDate:employee.terminationDate,createdById:session.user.id,snapshot,netAmount:snapshot.totals.netSettlement}});
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
  if(typeof body?.id!=="string" || !["approve","cancel","confirm-payment","return"].includes(body?.action)) return response({success:false,message:"الإجراء غير صالح"},400);
  try {
    const record = await prisma.$transaction(async tx=>{
      const old = await tx.employeeFinalSettlement.findUnique({where:{id:body.id}});
      if(!old)throw Error("المخالصة غير موجودة");
      if(body.action==="return"){
        if(old.status!=="APPROVED" || old.paymentConfirmedAt)throw Error("لا يمكن إرجاع مخالصة مصروفة");
        const changed=await tx.employeeFinalSettlement.updateMany({where:{id:old.id,status:"APPROVED",updatedAt:old.updatedAt},data:{status:"DRAFT",approvedById:null,approvedAt:null}});
        if(changed.count!==1)throw Error("تغيرت المخالصة");
        await tx.employeeRequestExecution.updateMany({where:{sourceType:"FINAL_SETTLEMENT",sourceId:old.id,effectType:"APPROVAL_RECORDED"},data:{state:"REVERSED"}});
        await tx.auditLog.create({data:{actorUserId:session.user.id,action:"final-settlement:return",entity:"employeeFinalSettlement",entityId:old.id,metadata:{previousSnapshot:old.snapshot,previousApprover:old.approvedById}}});
        return tx.employeeFinalSettlement.findUniqueOrThrow({where:{id:old.id}});
      }
      if(body.action==="confirm-payment"){
        const parsed=settlementPaymentInput.safeParse(body);
        if(!parsed.success || old.status!=="APPROVED" || old.approvedById===session.user.id)throw Error("يتطلب تأكيد الصرف مراجعا آخر ومبلغاً ومرجعاً موثقين");
        if(Number(old.netAmount)!==parsed.data.confirmedAmount || Number(old.netAmount)<0)throw Error("المبلغ لا يطابق المخالصة المعتمدة");
        const frozen=settlementDebtSnapshot.safeParse(old.snapshot);
        if(!frozen.success)throw Error("لقطة المصادر قديمة؛ يلزم إعادة المراجعة");
        const current=await readSources(tx,old.employeeId);
        if(JSON.stringify(settlementDebtSnapshot.parse(current))!==JSON.stringify(frozen.data))throw Error("تغيرت مصادر المخالصة؛ يلزم إرجاعها وإعادة المراجعة");
        if(current.debtSources.some(row=>row.kind==="LOAN"&&row.external&&!row.installmentIds))throw Error("يلزم إعادة مطابقة أقساط Odoo");
        const pending=await tx.payrollItem.findFirst({where:{employeeId:old.employeeId,payrollRun:{status:{in:["DRAFT","PROCESSING","APPROVED"]}}},select:{id:true}});
        if(pending)throw Error("توجد مسيرات غير مقفلة للموظف؛ يلزم مراجعتها أولا");
        const employee=await tx.employee.findUnique({where:{id:old.employeeId},select:{hireDate:true,terminationDate:true}});
        if(!employee?.terminationDate || employee.terminationDate.getTime()!==old.terminationDate.getTime())throw Error("تغير تاريخ انتهاء الخدمة");
        const raw=old.snapshot as unknown as ReturnType<typeof makeFinalSettlementSnapshot>;
        const inputs=finalSettlementInput.parse(raw.input);
        const balance=await tx.employeeLeaveBalance.findUnique({where:{employeeId:old.employeeId}});
        const encash=inputs.encashRemainingLeave?calculateLeaveEncashment(balance?{accrued:Number(balance.accrued),used:Number(balance.used)}:null,inputs.monthlyWage):{days:0,amount:0};
        if(encash.amount!==inputs.leaveEncashment)throw Error("مقابل الإجازات تغير أو غير موثق؛ أعد المراجعة");
        if(encash.days>0 && await tx.leaveRequest.count({where:{employeeId:old.employeeId,status:"PENDING"}}))throw Error("توجد طلبات إجازة معلقة؛ راجعها قبل تسوية الرصيد");
        const recomputed=makeFinalSettlementSnapshot(inputs,employee.hireDate,employee.terminationDate,money(current.debtSources.reduce((sum,row)=>sum+row.amount,0)));
        if(recomputed.totals.netSettlement!==Number(old.netAmount))throw Error("تغيرت مستحقات المخالصة");
        const rows=buildFinalSettlementEntries(recomputed,current.debtSources);
        const now=new Date();
        const changed=await tx.employeeFinalSettlement.updateMany({where:{id:old.id,status:"APPROVED",updatedAt:old.updatedAt},data:{status:"PAID",paymentReference:parsed.data.reference,paymentConfirmedById:session.user.id,paymentConfirmedAt:now}});
        if(changed.count!==1)throw Error("سبق تأكيد المخالصة");
        for(const source of current.debtSources){
          if(source.kind==="LOAN"){
            const changed=await tx.loan.updateMany({where:{id:source.id,employeeId:old.employeeId,status:"ACTIVE",outstandingAmount:source.amount,updatedAt:new Date(source.version),odooSource:source.external?{not:null}:null},data:{outstandingAmount:0,status:"PAID"}});
            if(changed.count!==1)throw Error("تغير رصيد القرض");
            if(source.external && source.installmentIds?.length){
              const consumed=await tx.odooLoanInstallment.updateMany({where:{loanId:source.id,id:{in:source.installmentIds},remotePaid:false,localPaidAt:null},data:{localPaidAt:now}});
              if(consumed.count!==source.installmentIds.length)throw Error("تغيرت أقساط Odoo");
            }
          }else{
            const advance=await tx.employeeSalaryAdvance.findUniqueOrThrow({where:{id:source.id}});
            const changed=await tx.employeeSalaryAdvance.updateMany({where:{id:source.id,employeeId:old.employeeId,status:"APPROVED",updatedAt:new Date(source.version)},data:{paidInstallments:advance.installments,status:"PAID"}});
            if(changed.count!==1)throw Error("تغير رصيد السلفة");
          }
        }
        if(encash.days>0){
          if(!balance)throw Error("رصيد الإجازات غير موثق");
          const consumed=await tx.employeeLeaveBalance.updateMany({where:{employeeId:old.employeeId,updatedAt:balance.updatedAt,accrued:balance.accrued,used:balance.used},data:{used:{increment:encash.days}}});
          if(consumed.count!==1)throw Error("تغير رصيد الإجازات");
          await tx.employeeRequestExecution.create({data:{employeeId:old.employeeId,sourceType:"FINAL_SETTLEMENT",sourceId:old.id,effectType:"LEAVE_ENCASHED",state:"EXECUTED",executedAt:now,metadata:{days:encash.days,amount:encash.amount}}});
        }
        if(rows.length)await tx.employeeFinancialEntry.createMany({data:rows.map(row=>({...row,employeeId:old.employeeId,sourceType:"FINAL_SETTLEMENT",sourceId:old.id,currency:old.currency,occurredAt:now}))});
        await tx.employeeRequestExecution.create({data:{employeeId:old.employeeId,sourceType:"FINAL_SETTLEMENT",sourceId:old.id,effectType:"PAYMENT_CONFIRMED",state:"EXECUTED",executedAt:now,metadata:{netAmount:String(old.netAmount),paymentConfirmed:true}}});
        await tx.auditLog.create({data:{actorUserId:session.user.id,action:"final-settlement:payment-confirmed",entity:"employeeFinalSettlement",entityId:old.id,metadata:{employeeId:old.employeeId,netAmount:String(old.netAmount),reference:parsed.data.reference,externalPaymentAttested:true}}});
        return tx.employeeFinalSettlement.findUniqueOrThrow({where:{id:old.id}});
      }
      if(old.status!=="DRAFT") throw new Error("المخالصة ليست مسودة");
      if(body.action==="approve" && old.createdById===session.user.id) throw new Error("اعتماد المخالصة يحتاج مراجعاً آخر");
      const now=new Date();
      const changed=await tx.employeeFinalSettlement.updateMany({where:{id:old.id,status:"DRAFT",updatedAt:old.updatedAt},data:body.action==="approve"?{status:"APPROVED",approvedById:session.user.id,approvedAt:now}:{status:"CANCELLED"}});
      if(changed.count!==1) throw new Error("تغيرت المخالصة أثناء المراجعة");
      await tx.auditLog.create({data:{actorUserId:session.user.id,action:"final-settlement:"+body.action,entity:"employeeFinalSettlement",entityId:old.id,metadata:{employeeId:old.employeeId,netAmount:String(old.netAmount),paymentExecuted:false}}});
      if(body.action==="approve") await tx.employeeRequestExecution.upsert({where:{sourceType_sourceId_effectType:{sourceType:"FINAL_SETTLEMENT",sourceId:old.id,effectType:"APPROVAL_RECORDED"}},create:{employeeId:old.employeeId,sourceType:"FINAL_SETTLEMENT",sourceId:old.id,effectType:"APPROVAL_RECORDED",state:"EXECUTED",executedAt:now,metadata:{netAmount:String(old.netAmount),paymentConfirmed:false}},update:{state:"EXECUTED",executedAt:now,metadata:{netAmount:String(old.netAmount),paymentConfirmed:false}}});
      return tx.employeeFinalSettlement.findUniqueOrThrow({where:{id:old.id}});
    },{isolationLevel:"Serializable"});
    return response({success:true,record});
  } catch(error) {return response({success:false,message:error instanceof Prisma.PrismaClientKnownRequestError?"تعارض في البيانات؛ حدّث الصفحة":error instanceof Error?error.message:"تعذر التنفيذ"},409);}
}
