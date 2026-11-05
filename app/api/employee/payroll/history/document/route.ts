import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppSetting } from "@/lib/settings";
import { payrollDocument } from "@/lib/payroll/document";
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});
 const employee=await prisma.employee.findFirst({where:{userId:session.user.id},select:{id:true,firstName:true,lastName:true,employeeNumber:true}});if(!employee)return NextResponse.json({success:false},{status:403});
 const id=new URL(request.url).searchParams.get("id")??"";
 const slip=await prisma.historicalPayslip.findFirst({where:{id,employeeId:employee.id,state:{in:["done","paid"]}},include:{lines:{orderBy:{externalId:"asc"}}}});if(!slip)return NextResponse.json({success:false},{status:404});
 const company=await getAppSetting("company.name");const reference=`LANA-ODOO-HISTORY-${slip.id}`;const qr=await QRCode.toDataURL(reference);
 const sourceHeader=slip.raw as {credit_note?:boolean};
 const rows=[...(sourceHeader.credit_note?[{label:"نوع الكشف",value:"قيد عكسي / إشعار دائن في المصدر"}]:[]),{label:"حالة المصدر",value:slip.state==="paid"?"مسدد في Odoo":"معتمد في Odoo — لا يثبت الصرف"},...slip.lines.map(line=>({label:`${line.name} (${line.code})`,value:`قيمة ${line.amount} × كمية ${line.quantity} × نسبة ${line.rate}% = ${line.total}`})),{label:"الإجمالي",value:String(slip.gross)},{label:"الاستقطاعات",value:String(slip.deductions)},{label:"الصافي التاريخي",value:String(slip.net)}];
 return new NextResponse(payrollDocument({title:"كشف راتب تاريخي من Odoo",company:typeof company==="string"?company:"LANA HRMS",employee:`${employee.firstName} ${employee.lastName}`,number:employee.employeeNumber,period:slip.fromDate.toISOString().slice(0,7),currency:slip.currency,rows,qr,reference}),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","Content-Security-Policy":"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'"}});
}
