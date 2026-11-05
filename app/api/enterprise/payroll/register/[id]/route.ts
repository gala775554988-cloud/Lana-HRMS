import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canViewPayroll } from '@/lib/enterprise/payroll-permissions';
import { applyScopedWhere,getAccessProfile } from '@/lib/enterprise/hierarchy';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});if(!canViewPayroll(session))return NextResponse.json({success:false},{status:403});
 const {id}=await params,source=new URL(request.url).searchParams.get('source');const scope=await applyScopedWhere('employees',{},await getAccessProfile(session.user.id,session.user.roles??[]));
 if(source==='ODOO'){
  const row=await prisma.historicalPayslip.findUnique({where:{id},include:{lines:{orderBy:{externalId:'asc'}},run:true}});if(!row)return NextResponse.json({success:false},{status:404});
  const employee=await prisma.employee.findFirst({where:{AND:[scope,{id:row.employeeId}]},select:{id:true,firstName:true,lastName:true,employeeNumber:true,department:{select:{name:true}},branch:{select:{name:true}}}});if(!employee)return NextResponse.json({success:false},{status:404});
  return NextResponse.json({success:true,source,employee,payslip:{id:row.id,period:row.run.period,state:row.state,currency:row.currency,basic:row.basic,gross:row.gross,deductions:row.deductions,net:row.net,odooPayslipId:row.odooPayslipId,moveId:row.moveId,fromDate:row.fromDate,toDate:row.toDate},lines:row.lines.map(l=>({id:l.id,code:l.code,name:l.name,kind:l.category,amount:l.amount,quantity:l.quantity,rate:l.rate,total:l.total}))},{headers:{'Cache-Control':'private, no-store'}});
 }
 if(source!=='LOCAL')return NextResponse.json({success:false},{status:400});
 const row=await prisma.payrollItem.findFirst({where:{id,employee:scope},include:{payrollRun:true,employee:{select:{id:true,firstName:true,lastName:true,employeeNumber:true,department:{select:{name:true}},branch:{select:{name:true}}}}}});if(!row)return NextResponse.json({success:false},{status:404});
 const snapshot=row.calculationSnapshot as {components?:{code:string;name:string;kind:string;amount:number}[]}|null;
 return NextResponse.json({success:true,source,employee:row.employee,payslip:{id:row.id,period:row.payrollRun.period,state:row.payrollRun.status,currency:row.currency,basic:row.baseSalary,gross:row.grossPay,deductions:row.deductionTotal,net:row.netPay,fromDate:row.payrollRun.periodStartDate,toDate:row.payrollRun.periodEndDate},lines:(snapshot?.components??[]).map((l,i)=>({...l,id:String(i),quantity:1,rate:100,total:l.amount}))},{headers:{'Cache-Control':'private, no-store'}});
}
