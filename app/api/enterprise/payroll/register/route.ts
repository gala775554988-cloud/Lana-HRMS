import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canViewPayroll } from '@/lib/enterprise/payroll-permissions';
import { applyScopedWhere,getAccessProfile } from '@/lib/enterprise/hierarchy';
import { payrollRegister } from '@/lib/payroll/register';
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});if(!canViewPayroll(session))return NextResponse.json({success:false},{status:403});
 const q=new URL(request.url).searchParams,source=q.get('source')??'ALL',view=q.get('view')??'payslips';if(!['ALL','LOCAL','ODOO'].includes(source)||!['payslips','runs','overview'].includes(view))return NextResponse.json({success:false,message:'فلتر غير صالح'},{status:400});
 const scope=await applyScopedWhere('employees',{},await getAccessProfile(session.user.id,session.user.roles??[]));
 const employees=await prisma.employee.findMany({where:{AND:[scope,...(q.get('employeeId')?[{id:q.get('employeeId')!}]:[])]},select:{id:true},take:50001});if(employees.length>50000)return NextResponse.json({success:false,message:'حدد نطاق الموظفين لتقليص النتائج'},{status:400});
 const number=(key:string,fallback:number,max:number)=>{const v=Number(q.get(key)??fallback);return Number.isSafeInteger(v)&&v>0?Math.min(v,max):fallback;};
 try{return NextResponse.json({success:true,...await payrollRegister({employeeIds:employees.map(e=>e.id),source:source as 'ALL'|'LOCAL'|'ODOO',period:q.get('period')??'',search:(q.get('search')??'').slice(0,150),status:q.get('status')??'',currency:q.get('currency')??'',runId:q.get('runId')??'',page:number('page',1,100000),pageSize:number('pageSize',20,100)},view as 'payslips'|'runs'|'overview')},{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({success:false,message:'تعذر تحميل سجل الرواتب؛ تحقق من اتصال قاعدة البيانات'},{status:500});}
}
