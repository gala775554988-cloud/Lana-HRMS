import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewPayroll } from "@/lib/enterprise/payroll-permissions";
import { buildExcelTable, buildPdfTable } from "@/lib/exports/table-files";
import { groupPayrollReport } from "@/lib/payroll/report-totals";
import { advanceSchedule } from "@/lib/payroll/calculations";
import type { Prisma, PayrollStatus } from "@prisma/client";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const titles={register:"كشف الرواتب التفصيلي",summary:"ملخص الرواتب","by-department":"الرواتب حسب القسم","by-branch":"الرواتب حسب الفرع","by-cost-center":"الرواتب حسب مركز التكلفة",allowances:"كشف البدلات",deductions:"كشف الاستقطاعات",loans:"كشف السلف والقروض"} as const;
type Kind=keyof typeof titles;
type Row=Record<string,string|number|boolean|null>;
const MAX=10000;
const privateHeaders={"Cache-Control":"private, no-store"};
const response=(body:object,status=200)=>NextResponse.json(body,{status,headers:privateHeaders});
const employeeSelect={employeeNumber:true,firstName:true,lastName:true,department:{select:{name:true}},branch:{select:{name:true}}} as const;
function checked<T>(rows:T[]):T[]{if(rows.length>MAX)throw Error("عدد السجلات يتجاوز حد التصدير؛ حدد فترة أو مسيراً أقصر");return rows;}
const name=(employee:{firstName:string;lastName:string})=>employee.firstName+" "+employee.lastName;
export async function GET(request:NextRequest){
 const session=await auth();if(!session?.user?.id)return response({success:false,message:"Unauthorized"},401);
 if(!canViewPayroll(session))return response({success:false,message:"Forbidden"},403);
 const params=request.nextUrl.searchParams,report=(params.get("report")??"register") as Kind,format=(params.get("format")??"xlsx").toLowerCase();
 if(!Object.hasOwn(titles,report)||!["xlsx","pdf","json"].includes(format))return response({success:false,message:"نوع التقرير أو الصيغة غير صالح"},400);
 const period=params.get("period"),runId=params.get("runId"),status=params.get("status");
 if(period&& !/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return response({success:false,message:"حدد فترة بصيغة YYYY-MM"},400);
 if(status&&!["DRAFT","PROCESSING","APPROVED","PAID","LOCKED","ARCHIVED","CANCELLED"].includes(status))return response({success:false,message:"حالة المسير غير صالحة"},400);
 if(runId&&runId.length>128)return response({success:false},400);
 const runWhere:Prisma.PayrollRunWhereInput={...(runId?{id:runId}:{}),...(period?{period}:{}),...(status?{status:status as PayrollStatus}:{status:{not:"CANCELLED"}})};
 try{
 let rows:Row[]=[];
 if(["register","summary","by-department","by-branch","by-cost-center"].includes(report)){
  const items=checked(await prisma.payrollItem.findMany({where:{payrollRun:runWhere},take:MAX+1,orderBy:[{payrollRun:{period:"desc"}},{employeeId:"asc"}],include:{employee:{select:employeeSelect},costCenter:{select:{name:true}},payrollRun:{select:{period:true,status:true,costCenter:{select:{name:true}}}}}}));
  if(report==="register")rows=items.map(i=>({"الرقم الوظيفي":i.employee.employeeNumber,"الاسم":name(i.employee),"القسم":i.employee.department?.name??"","الفرع":i.employee.branch?.name??"","مركز التكلفة":i.costCenter?.name??i.payrollRun.costCenter?.name??"","الفترة":i.payrollRun.period,"الحالة":i.payrollRun.status,"العملة":i.currency,"الأساسي":Number(i.baseSalary),"البدلات":Number(i.allowanceTotal),"المكافآت":Number(i.bonusTotal),"الإضافي":Number(i.overtimeTotal),"الإجمالي":Number(i.grossPay),"تأمينات الموظف":Number(i.insuranceDeduction),"تأمينات المنشأة":Number(i.employerInsurance),"الضرائب":Number(i.taxTotal),"القروض":Number(i.loanDeduction),"السلف":Number(i.advanceDeduction),"الغياب":Number(i.absenceDeduction),"التأخير":Number(i.lateDeduction),"الجزاءات":Number(i.penaltyDeduction),"إجمالي الاستقطاعات":Number(i.deductionTotal),"الصافي":Number(i.netPay)}));
  else{
   const group=(i:typeof items[number])=>report==="by-department"?i.employee.department?.name??"بدون قسم":report==="by-branch"?i.employee.branch?.name??"بدون فرع":report==="by-cost-center"?i.costCenter?.name??i.payrollRun.costCenter?.name??"بدون مركز تكلفة":"الكل";
   rows=groupPayrollReport(items.map(i=>({period:i.payrollRun.period,status:i.payrollRun.status,currency:i.currency,group:group(i),gross:i.grossPay,deductions:i.deductionTotal,net:i.netPay,employer:i.employerInsurance}))).map(r=>({"الفترة":r.period,"الحالة":r.status,"التصنيف":r.group,"العملة":r.currency,"عدد السجلات":r.count,"إجمالي الأجر":r.gross,"الاستقطاعات":r.deductions,"الصافي":r.net,"تأمينات المنشأة":r.employer,"تكلفة المنشأة":r.cost,"فرق المطابقة":r.difference}));
  }
 }else if(report==="allowances"||report==="deductions"){
  const delegate=report==="allowances"?prisma.allowance:prisma.deduction;
  const items=checked(await (delegate as typeof prisma.allowance).findMany({where:{effectiveTo:null},include:{employee:{select:employeeSelect}},take:MAX+1,orderBy:{id:"asc"}}));
  rows=items.map(r=>({"الرقم الوظيفي":r.employee.employeeNumber,"الاسم":name(r.employee),"البند":r.name,"التصنيف":r.category,"المبلغ":Number(r.amount),"العملة":r.currency,"متكرر":r.isRecurring?"نعم":"لا","المصدر":r.source}));
 }else{
  const [loans,advances]=await Promise.all([prisma.loan.findMany({where:{status:"ACTIVE",OR:[{disbursementRequired:false},{disbursedAt:{not:null}}]},include:{employee:{select:employeeSelect}},take:MAX+1,orderBy:{id:"asc"}}),prisma.employeeSalaryAdvance.findMany({where:{status:"APPROVED",OR:[{disbursementRequired:false},{disbursedAt:{not:null}}]},include:{employee:{select:employeeSelect}},take:MAX+1,orderBy:{id:"asc"}})]);
  rows=checked([...loans.map(l=>({"النوع":"قرض","الرقم الوظيفي":l.employee.employeeNumber,"الاسم":name(l.employee),"المبلغ الأصلي":Number(l.principalAmount),"المتبقي":Number(l.outstandingAmount),"القسط التالي":Math.min(Number(l.installmentAmount),Number(l.outstandingAmount)),"العملة":l.currency,"الحالة":l.status})),...advances.map(a=>{const s=advanceSchedule({amount:Number(a.amount),monthlyDeduction:Number(a.monthlyDeduction),installments:a.installments,paidInstallments:a.paidInstallments});return {"النوع":"سلفة","الرقم الوظيفي":a.employee.employeeNumber,"الاسم":name(a.employee),"المبلغ الأصلي":Number(a.amount),"المتبقي":s.remaining,"القسط التالي":s.next,"العملة":"SAR","الحالة":a.status};})]);
 }
 if(format==="json")return response({success:true,title:titles[report],rows});
 const columns=Object.keys(rows[0]??{"الحالة":"لا توجد بيانات"}).map(key=>({key,label:key}));
 const bytes=format==="pdf"?await buildPdfTable(titles[report],columns,rows):await buildExcelTable(titles[report],columns,rows);
 await prisma.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:report-export",entity:"payrollReport",entityId:runId??report,metadata:{report,format,period,status,count:rows.length}}});
 return new NextResponse(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="payroll-'+report+'.'+format+'"'}});
 }catch(error){return response({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر تجهيز التقرير"},422);}
}
