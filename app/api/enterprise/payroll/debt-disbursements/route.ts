import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {canApprovePayroll} from "@/lib/enterprise/payroll-permissions";
import {debtConfirmationSchema,verifyDebtConfirmation} from "@/lib/payroll/debt-disbursement";
const response=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export const dynamic="force-dynamic";
export async function GET(){
 const session=await auth();if(!session?.user?.id)return response({success:false},401);if(!canApprovePayroll(session))return response({success:false},403);
 const [loans,advances]=await Promise.all([prisma.loan.findMany({where:{status:"ACTIVE",disbursementRequired:true,disbursedAt:null,odooSource:null},orderBy:{updatedAt:"asc"},take:100,select:{id:true,principalAmount:true,currency:true,employee:{select:{employeeNumber:true,firstName:true,lastName:true}}}}),prisma.employeeSalaryAdvance.findMany({where:{status:"APPROVED",managerStatus:"APPROVED",hrStatus:"APPROVED",financeStatus:"APPROVED",disbursementRequired:true,disbursedAt:null},orderBy:{updatedAt:"asc"},take:100,select:{id:true,amount:true,employee:{select:{employeeNumber:true,firstName:true,lastName:true}}}})]);
 return response({success:true,records:[...loans.map(l=>({kind:"LOAN",id:l.id,amount:String(l.principalAmount),currency:l.currency,employee:l.employee})),...advances.map(l=>({kind:"ADVANCE",id:l.id,amount:String(l.amount),currency:"SAR",employee:l.employee}))]});
}
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return response({success:false},401);if(!canApprovePayroll(session))return response({success:false},403);
 const parsed=debtConfirmationSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return response({success:false,message:"راجع المبلغ والمرجع وتاريخ الصرف"},400);
 const input=parsed.data;
 try{
 const result=await prisma.$transaction(async tx=>{
  const loan=input.kind==="LOAN"?await tx.loan.findUnique({where:{id:input.id},include:{employee:{select:{id:true,userId:true,status:true,archivedAt:true,terminationDate:true}}}}):null;
  const advance=input.kind==="ADVANCE"?await tx.employeeSalaryAdvance.findUnique({where:{id:input.id},include:{employee:{select:{id:true,userId:true,status:true,archivedAt:true,terminationDate:true}}}}):null;
  const source=loan??advance;if(!source)throw Error("الطلب غير موجود");
  if(source.employee.userId===session.user.id)throw Error("لا يمكنك تأكيد صرف طلبك");
  if(loan){
    const approved=await tx.workflowInstance.findFirst({where:{type:"LOAN",entityId:loan.id,employeeId:loan.employeeId,status:"COMPLETED"},select:{id:true}});
    if(!approved||loan.odooSource||!loan.outstandingAmount.equals(loan.principalAmount))throw Error("راجع الاعتماد ورصيد القرض");
    const approver=await tx.workflowStep.findFirst({where:{workflowInstanceId:approved.id,approverUserId:session.user.id,status:"APPROVED"},select:{id:true}});
    if(approver)throw Error("يلزم مراجع صرف مستقل عن معتمدي القرض");
  }
  const amount=loan?loan.principalAmount:advance!.amount,currency=loan?loan.currency:"SAR";
  const date=verifyDebtConfirmation(input,{amount:String(amount),currency,employeeActive:source.employee.status==="ACTIVE"&&!source.employee.archivedAt&&(!source.employee.terminationDate||source.employee.terminationDate>new Date()),disbursementRequired:source.disbursementRequired,disbursedAt:source.disbursedAt,approved:loan?loan.status==="ACTIVE":advance!.status==="APPROVED"&&advance!.managerStatus==="APPROVED"&&advance!.hrStatus==="APPROVED"&&advance!.financeStatus==="APPROVED"&&advance!.paidInstallments===0});
  const updated=loan?await tx.loan.updateMany({where:{id:loan.id,status:"ACTIVE",disbursedAt:null,updatedAt:loan.updatedAt,disbursementRequired:true},data:{disbursedAt:date}}):await tx.employeeSalaryAdvance.updateMany({where:{id:advance!.id,status:"APPROVED",disbursedAt:null,updatedAt:advance!.updatedAt,disbursementRequired:true},data:{disbursedAt:date}});
  if(updated.count!==1)throw Error("تغير الطلب أثناء المراجعة");
  const entry=await tx.payrollDebtDisbursement.create({data:{sourceType:input.kind,sourceId:input.id,employeeId:source.employee.id,amount,currency,reference:input.reference,confirmedById:session.user.id,disbursedAt:date}});
  await tx.employeeRequestExecution.create({data:{employeeId:source.employee.id,sourceType:input.kind,sourceId:input.id,effectType:"DISBURSEMENT_CONFIRMED",state:"EXECUTED",executedAt:new Date(),metadata:{amount:String(amount),currency,disbursedAt:date.toISOString(),paymentConfirmed:true}}});
  await tx.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:debt-disbursement-confirm",entity:"PayrollDebtDisbursement",entityId:entry.id,metadata:{sourceType:input.kind,sourceId:input.id,amount:String(amount),currency,reference:input.reference,externalPaymentAttested:true}}});
  if(source.employee.userId)await tx.notification.create({data:{userId:source.employee.userId,title:"تأكيد صرف السلفة أو القرض",body:"تم توثيق الصرف الخارجي وستُحتسب الأقساط وفق تاريخ الاستحقاق.",type:"INFO",link:"/employee/salary"}});
  return entry;
 },{isolationLevel:"Serializable"});
 return response({success:true,record:result},201);
 }catch(error){return response({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر التأكيد أو سبق استخدام المرجع"},409);}
}
