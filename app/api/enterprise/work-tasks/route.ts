import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {createTaskSchema,taskActionSchema,canTransition,checklistProgress,nextTaskDue,recurrenceAfter,taskMetrics} from "@/lib/enterprise/work-task-rules";
import {buildExcelTable,buildPdfTable} from "@/lib/exports/table-files";
import {randomUUID} from "node:crypto";
import type {Prisma} from "@prisma/client";
export const dynamic="force-dynamic";
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
async function actor(){
 const session=await auth();if(!session?.user?.id)return null;
 const userId=session.user.id,roles=session.user.roles??[];
 const employee=await prisma.employee.findFirst({where:{userId,status:"ACTIVE",archivedAt:null,OR:[{terminationDate:null},{terminationDate:{gt:new Date()}}]},select:{id:true}});
 const global=roles.includes("SUPER_ADMIN")||roles.includes("HR_MANAGER");
 const assignments=employee?await prisma.supervisorAssignment.findMany({where:{employeeId:employee.id,isActive:true,startDate:{lte:new Date()},OR:[{endDate:null},{endDate:{gte:new Date()}}]},select:{entityType:true,entityId:true}}):[];
 const scope:Prisma.EmployeeWhereInput[]=[];
 for(const x of assignments){if(x.entityType==="DEPARTMENT")scope.push({departmentId:x.entityId});else if(x.entityType==="BRANCH")scope.push({branchId:x.entityId});else if(x.entityType==="HOSPITAL")scope.push({hospitalId:x.entityId});else if(x.entityType==="PROJECT")scope.push({projectId:x.entityId});}
 return {userId,employeeId:employee?.id,global,scope,canAssign:global||scope.length>0};
}
type Actor=NonNullable<Awaited<ReturnType<typeof actor>>>;
const access=(a:Actor):Prisma.MadarWorkTaskWhereInput=>({OR:[...(a.employeeId?[{employeeId:a.employeeId}]:[]),{reviewerId:a.userId},{createdById:a.userId},...(a.global?[{id:{not:""}}]:[])]});
const include={employee:{select:{employeeNumber:true,firstName:true,lastName:true}},checklist:true,attachments:{select:{id:true,fileName:true,sizeBytes:true,createdAt:true}},comments:{orderBy:{createdAt:"desc" as const},take:30}} as const;
export async function GET(request:Request){
 const a=await actor();if(!a)return json({success:false},401);
 const q=new URL(request.url).searchParams;
 if(q.get("options")==="true"){
  if(!a.canAssign)return json({success:false},403);
  const employees=await prisma.employee.findMany({where:{status:"ACTIVE",archivedAt:null,id:{not:a.employeeId??""},...(a.global?{}:{OR:a.scope})},select:{id:true,employeeNumber:true,firstName:true,lastName:true,departmentId:true},orderBy:{employeeNumber:"asc"},take:500});
  const departments=await prisma.department.findMany({where:{id:{in:[...new Set(employees.flatMap(e=>e.departmentId?[e.departmentId]:[]))]}},select:{id:true,name:true}});
  return json({success:true,employees,departments});
 }
 const raw=Number(q.get("page")??1),page=Number.isSafeInteger(raw)&&raw>0?Math.min(raw,100000):1,where:Prisma.MadarWorkTaskWhereInput={AND:[access(a),...(q.get("mine")==="true"?[{employeeId:a.employeeId??"__none__"}]:[]),...(q.get("employeeId")?[{employeeId:q.get("employeeId")!}]:[])]};
 const from=q.get("from"),to=q.get("to");
 if(from||to){
  if(!from||!to||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return json({success:false,message:"فترة غير صالحة"},400);
  const start=new Date(from+"T00:00:00+03:00"),end=new Date(to+"T00:00:00+03:00");
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()-start.getTime()>93*86400000)return json({success:false,message:"حدد فترة لا تتجاوز 93 يوماً"},400);
  where.dueAt={gte:start,lt:end};
 }
 if(q.get("calendar")==="true"){
  if(!from||!to)return json({success:false},400);
  const tasks=await prisma.madarWorkTask.findMany({where,orderBy:[{dueAt:"asc"},{id:"asc"}],take:1001,select:{id:true,title:true,dueAt:true,status:true,priority:true,progress:true,employee:{select:{employeeNumber:true,firstName:true,lastName:true}}}});
  if(tasks.length>1000)return json({success:false,message:"عدد المهام كبير؛ حدد أسبوعاً أو موظفاً"},422);
  return json({success:true,tasks});
 }
 if(q.get("metrics")==="true"){
  if(!from||!to)return json({success:false},400);
  const rows=await prisma.madarWorkTask.findMany({where,take:10001,select:{employeeId:true,status:true,progress:true,dueAt:true,reviewedAt:true,employee:{select:{employeeNumber:true,firstName:true,lastName:true,departmentId:true,department:{select:{name:true}}}}}});
  if(rows.length>10000)return json({success:false,message:"حدد فترة أقصر للمؤشرات"},422);
  const now=new Date(),employees=new Map<string,typeof rows>(),departments=new Map<string,typeof rows>();
  for(const row of rows){const a=employees.get(row.employeeId)??[];a.push(row);employees.set(row.employeeId,a);const key=row.employee.departmentId??"__none__";const b=departments.get(key)??[];b.push(row);departments.set(key,b);}
  return json({success:true,total:taskMetrics(rows,now),employees:[...employees.entries()].map(([id,items])=>({id,label:items[0].employee.employeeNumber+" — "+items[0].employee.firstName+" "+items[0].employee.lastName,...taskMetrics(items,now)})),departments:[...departments.entries()].map(([id,items])=>({id,label:items[0].employee.department?.name??"بدون قسم",...taskMetrics(items,now)}))});
 }
 const format=q.get("format");
 if(format==="xlsx"||format==="pdf"){
  const limit=format==="pdf"?500:2000;
  const tasks=await prisma.madarWorkTask.findMany({where,orderBy:[{dueAt:"asc"},{id:"asc"}],take:limit+1,select:{title:true,status:true,priority:true,progress:true,dueAt:true,reviewedAt:true,employee:{select:{employeeNumber:true,firstName:true,lastName:true,department:{select:{name:true}}}}}});
  if(tasks.length>limit)return json({success:false,message:"عدد التكليفات يتجاوز حد التصدير؛ حدد موظفاً"},422);
  const rows=tasks.map(t=>({title:t.title,employee:t.employee.employeeNumber+" "+t.employee.firstName+" "+t.employee.lastName,department:t.employee.department?.name??"",status:t.status,priority:t.priority,progress:t.progress,due:t.dueAt.toISOString(),reviewed:t.reviewedAt?.toISOString()??"",late:t.status!=="COMPLETED"&&t.dueAt<new Date()}));
  const columns=[{key:"title",label:"المهمة"},{key:"employee",label:"الموظف"},{key:"department",label:"القسم"},{key:"status",label:"الحالة"},{key:"priority",label:"الأولوية"},{key:"progress",label:"الإنجاز % "},{key:"due",label:"الاستحقاق"},{key:"reviewed",label:"الاعتماد"},{key:"late",label:"متأخرة"}];
  const bytes=format==="pdf"?await buildPdfTable("تقرير التكليفات",columns,rows):await buildExcelTable("تقرير التكليفات",columns,rows);
  await prisma.auditLog.create({data:{actorUserId:a.userId,action:"work-task:export",entity:"MadarWorkTask",metadata:{format,count:rows.length}}});
  return new NextResponse(new Uint8Array(bytes),{headers:{"Cache-Control":"private, no-store","Content-Type":format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="madar-tasks.'+format+'"'}});
 }
 const [tasks,total,groups,late]=await Promise.all([prisma.madarWorkTask.findMany({where,include,orderBy:[{dueAt:"asc"},{id:"asc"}],skip:(page-1)*50,take:50}),prisma.madarWorkTask.count({where}),prisma.madarWorkTask.groupBy({where,by:["status"],_count:{id:true}}),prisma.madarWorkTask.count({where:{AND:[where,{status:{not:"COMPLETED"},dueAt:{lt:new Date()}}]}})]);
 return json({success:true,tasks:tasks.map(t=>({...t,assignee:t.employeeId===a.employeeId,reviewer:t.reviewerId===a.userId&&t.employeeId!==a.employeeId})),total,page,groups,late,canAssign:a.canAssign});
}
export async function POST(request:Request){
 const a=await actor();if(!a)return json({success:false},401);if(!a.canAssign)return json({success:false},403);
 const parsed=createTaskSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({success:false,message:"راجع بيانات المهمة والمستلمين"},400);
 const v=parsed.data,due=new Date(v.dueAt),until=v.repeatUntil?new Date(v.repeatUntil):null;
 if(until&&(until<=due||until.getTime()-due.getTime()>366*5*86400000))return json({success:false,message:"حدد نهاية تكرار بعد الاستحقاق وبحد أقصى خمس سنوات"},400);
 const next=v.repeatEvery?nextTaskDue(due,v.repeatEvery,due):null;if(due<=new Date())return json({success:false,message:"موعد الاستحقاق يجب أن يكون مستقبلياً"},400);
 try{
 const count=await prisma.$transaction(async tx=>{
  const selected=await tx.employee.findMany({where:{AND:[{status:"ACTIVE",archivedAt:null,id:{not:a.employeeId??""},OR:[{terminationDate:null},{terminationDate:{gt:new Date()}}]},a.global?{}:{OR:a.scope},v.departmentId?{departmentId:v.departmentId}:{id:{in:v.employeeIds}}]},select:{id:true,userId:true},take:101});
  if(!selected.length||selected.length>100||(!v.departmentId&&selected.length!==new Set(v.employeeIds).size))throw Error("المستلمون خارج الصلاحية أو العدد يتجاوز 100");
  const groupKey=randomUUID();
  for(const e of selected){
   const task=await tx.madarWorkTask.create({data:{employeeId:e.id,createdById:a.userId,reviewerId:a.userId,groupKey,title:v.title,description:v.description,priority:v.priority,dueAt:due,repeatEvery:v.repeatEvery,repeatUntil:until,nextDueAt:next&&until&&next<=until?next:null,checklist:{create:v.checklist.map(title=>({title}))}}});
   if(e.userId)await tx.notification.create({data:{userId:e.userId,title:"تكليف جديد",body:v.title,type:"INFO",link:"/employee/tasks"}});
   await tx.auditLog.create({data:{actorUserId:a.userId,action:"work-task:create",entity:"MadarWorkTask",entityId:task.id,metadata:{employeeId:e.id,groupKey}}});
  }
  return selected.length;
 },{isolationLevel:"Serializable",timeout:30000});return json({success:true,count},201);
 }catch(e){return json({success:false,message:e instanceof Error&&!("code" in e)?e.message:"تعذر إنشاء التكليف"},409);}
}
export async function PATCH(request:Request){
 const a=await actor();if(!a)return json({success:false},401);
 const id=new URL(request.url).searchParams.get("id");const parsed=taskActionSchema.safeParse(await request.json().catch(()=>null));if(!id||!parsed.success)return json({success:false,message:"إجراء غير صالح"},400);
 const v=parsed.data;
 try{
 await prisma.$transaction(async tx=>{
  const t=await tx.madarWorkTask.findFirst({where:{AND:[{id},access(a)]},include:{checklist:true,employee:{select:{userId:true}}}});
  if(!t)throw Error("المهمة غير متاحة");
  const assignee=t.employeeId===a.employeeId,reviewer=t.reviewerId===a.userId&&!assignee;
  if(!assignee&&!reviewer)throw Error("صلاحية عرض فقط");
  if(t.updatedAt.toISOString()!==v.version)throw Error("تغيرت المهمة؛ حدّث الصفحة");
  const claimed=await tx.madarWorkTask.updateMany({where:{id,status:t.status,updatedAt:t.updatedAt},data:{updatedAt:new Date()}});if(claimed.count!==1)throw Error("تغيرت المهمة");
  if(v.action==="comment")await tx.madarWorkTaskComment.create({data:{taskId:id,authorId:a.userId,body:v.body}});
  else if(v.action==="recurrence"){
   if(!reviewer||t.occurrenceKey||!t.repeatEvery)throw Error("تعديل السلسلة متاح لمراجع المهمة الأصلية فقط");
   if(Boolean(v.frequency)!==Boolean(v.until))throw Error("حدد التكرار ونهايته أو أوقف السلسلة");
   const until=v.until?new Date(v.until):null;
   const next=v.frequency&&until?recurrenceAfter(t.dueAt,v.frequency,new Date(),until):null;
   if(next&&await tx.madarWorkTask.findUnique({where:{occurrenceKey:JSON.stringify([t.id,next.toISOString()])},select:{id:true}}))throw Error("الموعد التالي منشأ مسبقاً؛ اختر تكراراً آخر");
   await tx.madarWorkTask.update({where:{id},data:{repeatEvery:v.frequency??t.repeatEvery,repeatUntil:until,nextDueAt:next}});
  }
  else if(v.action==="move"){
   if(!canTransition(t.status,v.status,assignee,reviewer,t.progress))throw Error("الانتقال غير مسموح؛ اكتمال المهمة يتطلب اعتماد المراجع");
   await tx.madarWorkTask.update({where:{id},data:{status:v.status,reviewedAt:v.status==="COMPLETED"?new Date():null}});
   const recipient=v.status==="REVIEW"?t.reviewerId:reviewer?t.employee.userId:null;
   if(recipient)await tx.notification.create({data:{userId:recipient,title:"تحديث تكليف",body:t.title,type:"INFO",link:recipient===t.reviewerId?"/work-tasks":"/employee/tasks"}});
  }else{
   if(!assignee||t.status!=="IN_PROGRESS")throw Error("التقدم متاح للموظف أثناء التنفيذ فقط");
   if(v.action==="check"){
    const changed=await tx.madarWorkTaskCheck.updateMany({where:{id:v.checkId,taskId:id},data:{done:v.done}});if(changed.count!==1)throw Error("البند غير متاح");
    const items=await tx.madarWorkTaskCheck.findMany({where:{taskId:id}});await tx.madarWorkTask.update({where:{id},data:{progress:checklistProgress(items)}});
   }else{if(t.checklist.length)throw Error("الإنجاز محسوب من البنود الفرعية");await tx.madarWorkTask.update({where:{id},data:{progress:v.progress}});}
  }
  await tx.auditLog.create({data:{actorUserId:a.userId,action:"work-task:"+v.action,entity:"MadarWorkTask",entityId:id,metadata:{previousStatus:t.status,...(v.action==="move"?{nextStatus:v.status}:v.action==="recurrence"?{previousFrequency:t.repeatEvery,previousNext:t.nextDueAt?.toISOString()??null,nextFrequency:v.frequency,until:v.until}:{})}}});
 },{isolationLevel:"Serializable"});return json({success:true});
 }catch(e){return json({success:false,message:e instanceof Error&&!("code" in e)?e.message:"تعذر التعديل"},409);}
}
