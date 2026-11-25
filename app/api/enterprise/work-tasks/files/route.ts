import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {createHash} from "node:crypto";
import type {Prisma} from "@prisma/client";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers});
const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
async function access(){const session=await auth();if(!session?.user?.id)return null;const id=session.user.id,roles=session.user.roles??[],global=roles.includes("SUPER_ADMIN")||roles.includes("HR_MANAGER");
 const employee=await prisma.employee.findFirst({where:{userId:id,status:"ACTIVE",archivedAt:null,OR:[{terminationDate:null},{terminationDate:{gt:new Date()}}]},select:{id:true}});
 const where:Prisma.MadarWorkTaskWhereInput={OR:[{reviewerId:id},{createdById:id},...(employee?[{employeeId:employee.id}]:[]),...(global?[{id:{not:""}}]:[])]};return {id,employeeId:employee?.id,where};
}
export async function GET(request:Request){const a=await access();if(!a)return json({success:false},401);const id=new URL(request.url).searchParams.get("id");if(!id)return json({success:false},400);
 const file=await prisma.madarWorkTaskFile.findFirst({where:{id,task:a.where}});if(!file)return json({success:false},404);if(sha(file.bytes)!==file.sha256)return json({success:false},409);
 await prisma.auditLog.create({data:{actorUserId:a.id,action:"work-task:file-download",entity:"MadarWorkTask",entityId:file.taskId,metadata:{fileId:id}}});
 return new NextResponse(new Uint8Array(file.bytes),{headers:{...headers,"Content-Type":"application/octet-stream","X-Content-Type-Options":"nosniff","Content-Disposition":"attachment; filename=task-attachment.bin; filename*=UTF-8''"+encodeURIComponent(file.fileName.replace(/[\x00-\x1f\x7f]/g,"_")).replace(/'/g,"%27")}});
}
export async function POST(request:Request){const a=await access();if(!a)return json({success:false},401);if(Number(request.headers.get("content-length")??0)>1200000)return json({success:false},413);
 try{
 const form=await request.formData(),id=form.get("taskId"),file=form.get("file");if(typeof id!=="string"||!(file instanceof File)||file.size<4||file.size>1000000)return json({success:false,message:"حجم المرفق حتى 1MB"},400);
 const bytes=new Uint8Array(await file.arrayBuffer()),hex=Buffer.from(bytes.slice(0,8)).toString("hex");
 if(!((/\.pdf$/i.test(file.name)&&hex.startsWith("255044462d"))||(/\.png$/i.test(file.name)&&hex==="89504e470d0a1a0a")||(/\.jpe?g$/i.test(file.name)&&hex.startsWith("ffd8ff"))))return json({success:false,message:"يدعم PDF وPNG وJPEG فقط"},400);
 const digest=sha(bytes);
 const result=await prisma.$transaction(async tx=>{
 const task=await tx.madarWorkTask.findFirst({where:{AND:[{id},a.where]},select:{id:true,employeeId:true,reviewerId:true,status:true}});if(!task||task.status==="COMPLETED"||!(task.employeeId===a.employeeId||task.reviewerId===a.id))throw Error("لا يمكن إضافة مرفق");
 const existing=await tx.madarWorkTaskFile.findUnique({where:{taskId_sha256:{taskId:id,sha256:digest}},select:{id:true}});if(existing)return existing;
 if(await tx.madarWorkTaskFile.count({where:{taskId:id}})>=10)throw Error("الحد الأقصى 10 مرفقات لكل مهمة");
 const row=await tx.madarWorkTaskFile.create({data:{taskId:id,authorId:a.id,fileName:file.name.slice(0,180),sha256:digest,bytes,sizeBytes:file.size},select:{id:true}});
 await tx.auditLog.create({data:{actorUserId:a.id,action:"work-task:file-upload",entity:"MadarWorkTask",entityId:id,metadata:{fileId:row.id,sha256:digest}}});return row;
 },{isolationLevel:"Serializable"});return json({success:true,id:result.id},201);
 }catch(error){return json({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر حفظ المرفق"},409);}
}
