import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({success:false},{status:401});
 const employee=await prisma.employee.findFirst({where:{userId:session.user.id},select:{id:true}});if(!employee)return NextResponse.json({success:false},{status:403});
 const value=Number(new URL(request.url).searchParams.get("page")??1);const page=Number.isSafeInteger(value)&&value>0?value:1;
 const where={employeeId:employee.id,state:{in:["done","paid"]}};
 const [items,total]=await Promise.all([prisma.historicalPayslip.findMany({where,orderBy:[{fromDate:"desc"},{id:"asc"}],skip:(page-1)*20,take:20,select:{id:true,odooPayslipId:true,state:true,currency:true,fromDate:true,toDate:true,basic:true,gross:true,deductions:true,net:true,moveId:true}}),prisma.historicalPayslip.count({where})]);
 return NextResponse.json({success:true,items,total,page},{headers:{"Cache-Control":"private, no-store"}});
}
