import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {parseLegacyTaskBackup,legacyStatus,legacyFileBytes} from "@/lib/enterprise/legacy-task-import";
import {createHash} from "node:crypto";
import {z} from "zod";
import type {Prisma} from "@prisma/client";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=120;
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const sha=(data:string|Uint8Array)=>createHash("sha256").update(data).digest("hex");
const mapping=z.record(z.string(),z.object({employeeId:z.string().min(1),due:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict());
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return json({success:false},401);if(!session.user.roles?.includes("SUPER_ADMIN"))return json({success:false},403);
 try{
 if(Number(request.headers.get("content-length")??0)>3500000)return json({success:false,message:"الملف يتجاوز الحد"},413);
 const fd=await request.formData(),file=fd.get("file"),mode=fd.get("mode");
 if(!(file instanceof File)||file.size<1||file.size>3000000||!file.name.toLowerCase().endsWith(".json")||!["preview","import"].includes(String(mode)))return json({success:false,message:"اختر JSON حتى 3MB و100 مهمة"},400);
 const content=await file.text(),tasks=parseLegacyTaskBackup(JSON.parse(content));
 const sources=tasks.map(t=>({key:"LANA-V9:"+String(t.id),hash:sha(JSON.stringify(t)),task:t}));
 const existing=await prisma.madarLegacyTaskImport.findMany({where:{sourceKey:{in:sources.map(s=>s.key)}},select:{sourceKey:true,sourceHash:true}});
 const preview=sha(content+":"+session.user.id+":"+JSON.stringify(existing.slice().sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey))));
 const rows=sources.map(s=>({id:String(s.task.id),title:s.task.title,department:s.task.dept,category:s.task.cat,due:s.task.due,oldStatus:s.task.status,docs:s.task.docs.length,quarantined:s.task.docs.filter(d=>!legacyFileBytes(d.name,d.data)).length,state:existing.some(e=>e.sourceKey===s.key&&e.sourceHash!==s.hash)?"CONFLICT":existing.some(e=>e.sourceKey===s.key)?"EXISTS":"NEW"}));
 if(mode==="preview")return json({success:true,preview,rows});
 if(fd.get("preview")!==preview||rows.some(r=>r.state==="CONFLICT"))return json({success:false,message:"تغيرت المعاينة أو يوجد معرف قديم متعارض؛ لا يتم الاستبدال"},409);
 const assignments=mapping.parse(JSON.parse(String(fd.get("mapping")??"{}")));
 const fresh=sources.filter(s=>!existing.some(e=>e.sourceKey===s.key));
 const actorId=session.user.id;
 const count=await prisma.$transaction(async tx=>{
  let added=0;
  for(const s of fresh){
   const t=s.task,choice=assignments[String(t.id)];
   if(!choice)throw Error("حدد موظفاً وتاريخاً لكل مهمة جديدة");
   const employee=await tx.employee.findFirst({where:{id:choice.employeeId,status:"ACTIVE",archivedAt:null,userId:{not:actorId},OR:[{terminationDate:null},{terminationDate:{gt:new Date()}}]},select:{id:true,userId:true}});
   if(!employee)throw Error("الموظف غير نشط أو هو المراجع نفسه");
   const due=new Date(choice.due+"T23:59:59+03:00");if(!Number.isFinite(due.getTime()))throw Error("تاريخ استحقاق غير صالح");
   const mapped=legacyStatus(t);
   const task=await tx.madarWorkTask.create({data:{employeeId:employee.id,createdById:actorId,reviewerId:actorId,groupKey:s.key,title:t.title,description:t.notes,priority:mapped.priority,status:mapped.status,progress:mapped.progress,dueAt:due,checklist:{create:t.subtasks.map(x=>({title:x.text,done:x.done}))},comments:{create:t.comments.map(x=>({authorId:actorId,body:"[تعليق مستورد من LANA PRO"+(x.time?" — "+x.time:"")+"] "+x.text}))}}});
   let quarantined=0;const hashes=new Set<string>();
   for(const doc of t.docs){const bytes=legacyFileBytes(doc.name,doc.data);if(!bytes){quarantined++;continue;}const digest=sha(bytes);if(hashes.has(digest))continue;hashes.add(digest);await tx.madarWorkTaskFile.create({data:{taskId:task.id,authorId:actorId,fileName:doc.name,sha256:digest,bytes:new Uint8Array(bytes),sizeBytes:bytes.length}});}
   // Original backup record is preserved as restricted data; no HTML rendering or
   // automatic execution of legacy data URLs, logs, or unknown attachment types.
   await tx.madarLegacyTaskImport.create({data:{sourceKey:s.key,sourceHash:s.hash,sourceJson:t as unknown as Prisma.InputJsonValue,taskId:task.id,importedById:actorId}});
   await tx.auditLog.create({data:{actorUserId:actorId,action:"work-task:legacy-import",entity:"MadarWorkTask",entityId:task.id,metadata:{sourceKey:s.key,sourceHash:s.hash,oldStatus:t.status,department:t.dept,category:t.cat,quarantined}}});
   if(employee.userId)await tx.notification.create({data:{userId:employee.userId,title:"تكليف مستورد يحتاج متابعة",body:t.title,type:"INFO",link:"/employee/tasks"}});
   added++;
  }
  return added;
 },{isolationLevel:"Serializable",timeout:60000});
 return json({success:true,added:count,skipped:sources.length-count},201);
 }catch(error){return json({success:false,message:error instanceof Error&&!("code" in error)?error.message:"تعذر الاستيراد؛ لم تستبدل أي مهمة"},409);}
}
