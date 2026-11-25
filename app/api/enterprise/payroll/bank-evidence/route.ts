import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { parseBankExtract, matchBankExtract } from "@/lib/payroll/bank-evidence";
import { createHash } from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers});
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return json({success:false},401);if(!canApprovePayroll(session))return json({success:false},403);
 const q=new URL(request.url).searchParams, id=q.get("download"),runId=q.get("runId");
 if(id){
  const file=await prisma.payrollBankEvidence.findUnique({where:{id},select:{originalBytes:true,sha256:true,payrollRunId:true,originalName:true}});
  if(!file)return json({success:false},404);
  if(hash(file.originalBytes)!==file.sha256)return json({success:false,message:"فشل التحقق من سلامة الملف"},409);
  await prisma.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:bank-evidence-download",entity:"payrollRun",entityId:file.payrollRunId,metadata:{evidenceId:id}}});
  return new NextResponse(new Uint8Array(file.originalBytes),{headers:{...headers,"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="bank-original.bin"; filename*=UTF-8\'\''+encodeURIComponent(file.originalName.replace(/[\u0000-\u001F\u007F]/g,"_")).replace(/'/g,"%27"),"X-Content-Type-Options":"nosniff"}});
 }
 if(!runId)return json({success:false},400);
 const records=await prisma.payrollBankEvidence.findMany({where:{payrollRunId:runId},orderBy:{createdAt:"desc"},take:20,select:{id:true,originalName:true,sha256:true,result:true,createdAt:true}});
 return json({success:true,records});
}
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return json({success:false},401);if(!canApprovePayroll(session))return json({success:false},403);
 try{
  const length=Number(request.headers.get("content-length")??0);if(length>3500000)return json({success:false,message:"حجم الملفات أكبر من الحد المسموح"},413);
  const form=await request.formData(),runId=form.get("runId"),original=form.get("original"),report=form.get("report");
  if(typeof runId!=="string"||!(original instanceof File)||!(report instanceof File)||original.size<1||original.size>2500000||report.size<1||report.size>500000||form.get("attested")!=="yes")return json({success:false,message:"يلزم الملف الأصلي وتقرير البنك المنفصل وتأكيد مطابقتهما"},400);
  const originalBytes=new Uint8Array(await original.arrayBuffer()),reportBytes=new Uint8Array(await report.arrayBuffer());
  const digest=hash(originalBytes),extractSha256=hash(reportBytes);
  if(digest===extractSha256)return json({success:false,message:"يلزم تقرير منفصل؛ لا تفتح الملف الأصلي"},400);
  const actual=parseBankExtract(new TextDecoder("utf-8",{fatal:true}).decode(reportBytes));
  const record=await prisma.$transaction(async tx=>{
   const run=await tx.payrollRun.findUnique({where:{id:runId},include:{items:{include:{employee:{select:{employeeNumber:true,companyId:true,bankAccounts:{where:{isPrimary:true},select:{iban:true}}}}}}}});
   if(!run||!run.paidAt||!["PAID","LOCKED","ARCHIVED"].includes(run.status)||!run.companyId)throw Error("يلزم مسير مصروف موثق لشركة محددة");
   const expected=run.items.map(item=>{
    if(item.employee.companyId!==run.companyId||item.employee.bankAccounts.length!==1)throw Error("راجع الشركة والحساب الرئيسي قبل المطابقة");
    return {employeeNumber:item.employee.employeeNumber,iban:item.employee.bankAccounts[0].iban,currency:item.currency,net:Number(item.netPay)};
   });
   const result=matchBankExtract(expected,actual);
   const existing=await tx.payrollBankEvidence.findUnique({where:{sha256:digest},select:{id:true,payrollRunId:true,extractSha256:true,result:true,createdAt:true}});
   if(existing){if(existing.payrollRunId!==runId||existing.extractSha256!==extractSha256)throw Error("الملف الأصلي مسجل مسبقاً بمرجع مختلف");return existing;}
   const saved=await tx.payrollBankEvidence.create({data:{payrollRunId:runId,originalName:original.name.slice(0,180),sha256:digest,originalBytes,extractSha256,result,uploadedById:session.user.id},select:{id:true,result:true,createdAt:true}});
   await tx.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:bank-evidence-import",entity:"payrollRun",entityId:runId,metadata:{evidenceId:saved.id,sha256:digest,matched:result.matched,signatureVerified:false}}});
   return saved;
  },{isolationLevel:"Serializable"});
  return json({success:true,record},201);
 }catch(error){return json({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر حفظ الملف أو يوجد تعارض"},409);}
}
