import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {canApprovePayroll} from "@/lib/enterprise/payroll-permissions";
import {inspectPayrollControls} from "@/lib/payroll/budget-control";
import {z} from "zod";
const response=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const amount=z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const base={currency:z.string().regex(/^[A-Z]{3}$/),enforce:z.boolean()};
const input=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("budget"),periodId:z.string().min(1),costCenterId:z.string().min(1),ceiling:amount,...base}).strict(),
 z.object({kind:z.literal("band"),positionId:z.string().min(1),minimum:amount,maximum:amount,...base}).strict()
]);
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return response({success:false},401);if(!canApprovePayroll(session))return response({success:false},403);
 const runId=new URL(request.url).searchParams.get("runId");
 if(runId){const run=await prisma.payrollRun.findUnique({where:{id:runId},include:{items:true}});if(!run)return response({success:false},404);return response({success:true,warnings:await inspectPayrollControls(prisma,run,run.items)});}
 const [budgets,bands,periods,centers,positions]=await Promise.all([prisma.payrollBudgetLimit.findMany({orderBy:{updatedAt:"desc"},take:200}),prisma.payrollSalaryBand.findMany({orderBy:{updatedAt:"desc"},take:200}),prisma.payrollPeriod.findMany({orderBy:{startDate:"desc"},take:100,select:{id:true,name:true,status:true}}),prisma.payrollCostCenter.findMany({where:{isActive:true},orderBy:{name:"asc"},select:{id:true,name:true}}),prisma.position.findMany({where:{isActive:true},orderBy:{title:"asc"},select:{id:true,title:true}})]);
 return response({success:true,budgets,bands,periods,centers,positions});
}
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return response({success:false},401);if(!canApprovePayroll(session))return response({success:false},403);
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return response({success:false,message:"بيانات الضبط غير صالحة"},400);
 const data=parsed.data;
 try{
 const saved=await prisma.$transaction(async tx=>{
 if(data.kind==="budget"){
  const {kind,...value}=data;
  const [period,center]=await Promise.all([tx.payrollPeriod.findUnique({where:{id:value.periodId}}),tx.payrollCostCenter.findUnique({where:{id:value.costCenterId}})]);
  if(!period||period.status!=="OPEN"||!center?.isActive)throw Error("الفترة مغلقة أو مركز التكلفة غير فعال");
  const key={periodId_costCenterId_currency:{periodId:value.periodId,costCenterId:value.costCenterId,currency:value.currency}};
  const previous=await tx.payrollBudgetLimit.findUnique({where:key});
  const row=await tx.payrollBudgetLimit.upsert({where:key,create:value,update:{ceiling:value.ceiling,enforce:value.enforce}});
  await tx.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:budget-policy",entity:"payrollBudgetLimit",entityId:row.id,metadata:{previous:previous?{ceiling:String(previous.ceiling),enforce:previous.enforce}:null,next:value}}});return row;
 }
 const {kind,...value}=data;
 if(Number(value.minimum)>Number(value.maximum))throw Error("الحد الأدنى يتجاوز الحد الأعلى");
 const position=await tx.position.findUnique({where:{id:value.positionId}});if(!position?.isActive)throw Error("المسمى غير فعال");
 const key={positionId_currency:{positionId:value.positionId,currency:value.currency}};
 const previous=await tx.payrollSalaryBand.findUnique({where:key});
 const row=await tx.payrollSalaryBand.upsert({where:key,create:value,update:{minimum:value.minimum,maximum:value.maximum,enforce:value.enforce}});
 await tx.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:salary-band",entity:"payrollSalaryBand",entityId:row.id,metadata:{previous:previous?{minimum:String(previous.minimum),maximum:String(previous.maximum),enforce:previous.enforce}:null,next:value}}});return row;
 },{isolationLevel:"Serializable"});
 return response({success:true,saved});
 }catch(error){return response({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر حفظ السياسة"},409);}
}
