import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {canApprovePayroll} from "@/lib/enterprise/payroll-permissions";
import {debtReviewVerified} from "@/lib/payroll/debt-review";
import {z} from "zod";
export const dynamic="force-dynamic";
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const schema=z.object({sourceType:z.enum(["LOAN","ADVANCE"]),sourceId:z.string().min(1).max(128),decision:z.enum(["VERIFIED","UNVERIFIED","NOT_DISBURSED"]),evidenceReference:z.string().trim().max(150),note:z.string().trim().min(10).max(1000)}).strict().refine(v=>v.decision!=="VERIFIED"||v.evidenceReference.length>=5);
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return json({success:false},401);if(!canApprovePayroll(session))return json({success:false},403);
 const q=new URL(request.url).searchParams,kind=q.get("kind")==="ADVANCE"?"ADVANCE":"LOAN",raw=Number(q.get("page")??1),page=Number.isSafeInteger(raw)&&raw>0?Math.min(raw,100000):1,skip=(page-1)*50;
 const employee={select:{employeeNumber:true,firstName:true,lastName:true}} as const;
 const where={disbursementRequired:false,disbursedAt:null};
 const [loans,advances,total]=await Promise.all([
  kind==="LOAN"?prisma.loan.findMany({where:{...where,odooSource:null,status:"ACTIVE"},skip,take:50,orderBy:{id:"asc"},include:{employee}}):[],
  kind==="ADVANCE"?prisma.employeeSalaryAdvance.findMany({where:{...where,status:"APPROVED"},skip,take:50,orderBy:{id:"asc"},include:{employee}}):[],
  kind==="LOAN"?prisma.loan.count({where:{...where,odooSource:null,status:"ACTIVE"}}):prisma.employeeSalaryAdvance.count({where:{...where,status:"APPROVED"}})
 ]);
 const rows=[...loans.map(l=>({sourceType:"LOAN" as const,sourceId:l.id,employeeId:l.employeeId,principal:String(l.principalAmount),currency:l.currency,remaining:String(l.outstandingAmount),employee:l.employee})),...advances.map(a=>({sourceType:"ADVANCE" as const,sourceId:a.id,employeeId:a.employeeId,principal:String(a.amount),currency:"SAR",remaining:null,employee:a.employee}))];
 const reviews=await prisma.payrollDebtReview.findMany({where:{sourceType:kind,sourceId:{in:rows.map(r=>r.sourceId)}}});
 return json({success:true,total,page,records:rows.map(r=>{const review=reviews.find(v=>v.sourceId===r.sourceId);return {...r,review:review??null,verified:debtReviewVerified(r,review)};})});
}
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return json({success:false},401);if(!canApprovePayroll(session))return json({success:false},403);
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({success:false,message:"يلزم توثيق قرار المراجعة ومرجع إثبات الصرف إن وجد"},400);
 const input=parsed.data;
 try{
 const record=await prisma.$transaction(async tx=>{
  const loan=input.sourceType==="LOAN"?await tx.loan.findUnique({where:{id:input.sourceId},include:{employee:{select:{userId:true}}}}):null;
  const advance=input.sourceType==="ADVANCE"?await tx.employeeSalaryAdvance.findUnique({where:{id:input.sourceId},include:{employee:{select:{userId:true}}}}):null;
  const source=loan??advance;
  if(!source||source.employee.userId===session.user.id||source.disbursementRequired||source.disbursedAt||loan?.odooSource||!(loan?loan.status==="ACTIVE":advance?.status==="APPROVED"))throw Error("المصدر غير قابل للمراجعة التاريخية أو يخص المراجع نفسه");
  const principal=loan?loan.principalAmount:advance!.amount,currency=loan?loan.currency:"SAR";
  const key={sourceType_sourceId:{sourceType:input.sourceType,sourceId:input.sourceId}};
  const previous=await tx.payrollDebtReview.findUnique({where:key});
  const data={employeeId:source.employeeId,principal,currency,decision:input.decision,evidenceReference:input.evidenceReference||null,note:input.note,reviewedById:session.user.id,reviewedAt:new Date()};
  const row=await tx.payrollDebtReview.upsert({where:key,create:{sourceType:input.sourceType,sourceId:input.sourceId,...data},update:data});
  await tx.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:legacy-debt-review",entity:"PayrollDebtReview",entityId:row.id,metadata:{sourceType:input.sourceType,sourceId:input.sourceId,previous:previous?{decision:previous.decision,reference:previous.evidenceReference,reviewedBy:previous.reviewedById,note:previous.note}:null,next:{decision:row.decision,reference:row.evidenceReference,note:row.note},historicalSourceUnchanged:true}}});
  return row;
 },{isolationLevel:"Serializable"});
 return json({success:true,record});
 }catch(error){return json({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر حفظ المراجعة"},409);}
}
