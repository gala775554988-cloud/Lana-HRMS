import {prisma} from "@/lib/prisma";
import {nextTaskDue,taskOccurrenceKey,taskReminderKey} from "./work-task-rules";
import {riyadhDay} from "./automation-rules";
export async function runWorkTaskAutomation(now=new Date()){
 const roots=await prisma.madarWorkTask.findMany({where:{nextDueAt:{lte:new Date(now.getTime()+86400000)},repeatEvery:{not:null}},orderBy:{nextDueAt:"asc"},take:50,select:{id:true}});
 let created=0,stopped=0;
 for(const root of roots){
  const result=await prisma.$transaction(async tx=>{
   const t=await tx.madarWorkTask.findUnique({where:{id:root.id},include:{checklist:true,employee:{select:{userId:true,status:true,archivedAt:true,terminationDate:true}}}});
   if(!t?.nextDueAt||!t.repeatEvery||!t.repeatUntil||t.nextDueAt>new Date(now.getTime()+86400000))return "SKIP";
   const reviewer=await tx.user.findUnique({where:{id:t.reviewerId},select:{isActive:true}});
   const invalid=!reviewer?.isActive||t.employee.status!=="ACTIVE"||!!t.employee.archivedAt||!!(t.employee.terminationDate&&t.employee.terminationDate<=now);
   const next=nextTaskDue(t.nextDueAt,t.repeatEvery,t.dueAt);
   const claimed=await tx.madarWorkTask.updateMany({where:{id:t.id,nextDueAt:t.nextDueAt},data:{nextDueAt:invalid||next>t.repeatUntil?null:next}});
   if(claimed.count!==1)return "SKIP";
   if(invalid){await tx.auditLog.create({data:{action:"work-task:recurrence-stopped",entity:"MadarWorkTask",entityId:t.id,metadata:{reason:"inactive assignee or reviewer"}}});return "STOP";}
   if(t.nextDueAt>t.repeatUntil)return "SKIP";
   const newTask=await tx.madarWorkTask.create({data:{employeeId:t.employeeId,createdById:t.createdById,reviewerId:t.reviewerId,groupKey:t.groupKey,title:t.title,description:t.description,priority:t.priority,dueAt:t.nextDueAt,occurrenceKey:taskOccurrenceKey(t.id,t.nextDueAt),checklist:{create:t.checklist.map(c=>({title:c.title}))}}});
   if(t.employee.userId)await tx.notification.create({data:{userId:t.employee.userId,title:"تكليف دوري جديد",body:t.title,type:"INFO",link:"/employee/tasks"}});
   await tx.auditLog.create({data:{action:"work-task:recurrence",entity:"MadarWorkTask",entityId:newTask.id,metadata:{rootId:t.id,dueAt:t.nextDueAt.toISOString()}}});
   return "CREATED";
  },{isolationLevel:"Serializable"});
  if(result==="CREATED")created++;else if(result==="STOP")stopped++;
 }
 const day=riyadhDay(now);
 const late=await prisma.madarWorkTask.findMany({where:{status:{not:"COMPLETED"},dueAt:{lt:now},employee:{status:"ACTIVE",archivedAt:null}},orderBy:{dueAt:"asc"},take:1000,select:{id:true,title:true,dueAt:true,reviewerId:true,employee:{select:{userId:true}}}});
 const ids=[...new Set(late.flatMap(t=>[t.reviewerId,...(t.employee.userId?[t.employee.userId]:[])]))];
 const active=new Set((await prisma.user.findMany({where:{id:{in:ids},isActive:true},select:{id:true}})).map(u=>u.id));
 const notices=late.flatMap(t=>[...new Set([t.reviewerId,...(t.employee.userId?[t.employee.userId]:[])])].filter(id=>active.has(id)).map(userId=>({userId,automationKey:taskReminderKey(t.id,userId,day,"late"),title:"تكليف متأخر",body:t.title,type:"WARNING" as const,link:userId===t.reviewerId?"/work-tasks":"/employee/tasks"})));
 const management=await prisma.user.findMany({where:{isActive:true,roles:{some:{role:{name:{in:["SUPER_ADMIN","HR_MANAGER"]}}}}},select:{id:true}});
 const escalation=late.filter(t=>now.getTime()-t.dueAt.getTime()>=72*3600000).flatMap(t=>management.map(u=>({userId:u.id,automationKey:taskReminderKey(t.id,u.id,day,"escalated"),title:"تصعيد تكليف متأخر أكثر من 72 ساعة",body:"يوجد تكليف يحتاج مراجعة الإدارة: "+t.title,type:"WARNING" as const,link:"/work-tasks"})));
 const upcoming=await prisma.madarWorkTask.findMany({where:{status:{not:"COMPLETED"},dueAt:{gte:now,lte:new Date(now.getTime()+86400000)},employee:{status:"ACTIVE",archivedAt:null,user:{isActive:true}}},select:{id:true,title:true,employee:{select:{userId:true}}},orderBy:{dueAt:"asc"},take:1000});
 const reminders=upcoming.flatMap(t=>t.employee.userId?[{userId:t.employee.userId,automationKey:taskReminderKey(t.id,t.employee.userId,day,"due-soon"),title:"تكليف يستحق خلال 24 ساعة",body:t.title,type:"WARNING" as const,link:"/employee/tasks"}]:[]);
 notices.push(...escalation,...reminders);
 const sent=notices.length?await prisma.notification.createMany({data:notices,skipDuplicates:true}):{count:0};
 return {created,stopped,reminders:sent.count,lateExamined:late.length,escalationCandidates:escalation.length,upcomingExamined:upcoming.length,backlogPossible:roots.length===50||late.length===1000||upcoming.length===1000};
}
