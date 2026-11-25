import {prisma} from "@/lib/prisma";
import {hrTaskPolicySchema,hrTaskPolicyKey,defaultHrTaskPolicy,hrEventKey,eventDue,type HrTaskPolicy} from "./hr-task-policy";
import type {Prisma} from "@prisma/client";
const hrRoles=["SUPER_ADMIN","HR_MANAGER"];
const hrUser={isActive:true,roles:{some:{role:{name:{in:hrRoles}}}}};
export async function loadHrTaskPolicy(){const setting=await prisma.appSetting.findUnique({where:{key:hrTaskPolicyKey}});return setting?hrTaskPolicySchema.parse(setting.value):defaultHrTaskPolicy;}
export async function validateHrTaskRecipients(policy:HrTaskPolicy){
 const [owner,reviewer]=await Promise.all([prisma.employee.findFirst({where:{id:policy.ownerEmployeeId,status:"ACTIVE",archivedAt:null,OR:[{terminationDate:null},{terminationDate:{gt:new Date()}}],user:hrUser},select:{id:true,userId:true}}),prisma.user.findFirst({where:{id:policy.reviewerUserId,...hrUser},select:{id:true}})]);
 if(!owner?.userId||!reviewer||owner.userId===reviewer.id)throw Error("يلزم مسؤول HR مرتبط بموظف نشط ومراجع HR مستقل");
 return {owner,reviewer};
}
export async function runHrEventTasks(now=new Date()){
 const p=await loadHrTaskPolicy();if(!p.enabled)return {enabled:false,created:0};
 const {owner,reviewer}=await validateHrTaskRecipients(p);
 const until=new Date(now.getTime()+p.noticeDays*86400000),active={status:"ACTIVE" as const,archivedAt:null,OR:[{terminationDate:null},{terminationDate:{gt:now}}]},limit=1001;
 type Candidate={kind:string;id:string;version:string;title:string;deadline:Date|null;reference:string};
 const candidates:Candidate[]=[];
 const add=(kind:string,id:string,version:string,title:string,deadline:Date|null,reference:string)=>candidates.push({kind,id,version,title,deadline,reference});
 const [docs,contracts,insurance,periods,steps,penalties,settlements,errors]=await Promise.all([
 p.kinds.includes("DOCUMENT")?prisma.employeeDocument.findMany({where:{status:"VERIFIED",expiresAt:{lte:until},employee:active},take:limit,orderBy:{id:"asc"},select:{id:true,expiresAt:true,type:true,employee:{select:{employeeNumber:true}}}}):[],
 p.kinds.includes("CONTRACT")?prisma.employeeContract.findMany({where:{status:"ACTIVE",endDate:{lte:until},employee:active},take:limit,orderBy:{id:"asc"},select:{id:true,endDate:true,employee:{select:{employeeNumber:true}}}}):[],
 p.kinds.includes("INSURANCE")?prisma.insurancePolicy.findMany({where:{status:"ACTIVE",endDate:{lte:until},employee:active},take:limit,orderBy:{id:"asc"},select:{id:true,endDate:true,employee:{select:{employeeNumber:true}}}}):[],
 p.kinds.includes("PAYROLL")?prisma.payrollPeriod.findMany({where:{status:"OPEN",endDate:{lte:until}},take:limit,orderBy:{id:"asc"},select:{id:true,endDate:true,name:true}}):[],
 p.kinds.includes("APPROVAL")?prisma.workflowStep.findMany({where:{status:"PENDING",workflowInstance:{status:"PENDING",updatedAt:{lte:new Date(now.getTime()-p.responseHours*3600000)}}},take:limit,orderBy:{id:"asc"},select:{id:true,step:true,workflowInstance:{select:{id:true,currentStep:true,employee:{select:{employeeNumber:true}}}}}}):[],
 p.kinds.includes("PENALTY")?prisma.deduction.findMany({where:{category:"PENALTY",effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gte:now}}],employee:active},take:limit,orderBy:{id:"asc"},select:{id:true,employee:{select:{employeeNumber:true}}}}):[],
 p.kinds.includes("SETTLEMENT")?prisma.employeeFinalSettlement.findMany({where:{status:{in:["DRAFT","APPROVED"]}},take:limit,orderBy:{id:"asc"},select:{id:true,terminationDate:true,employee:{select:{employeeNumber:true}}}}):[],
 p.kinds.includes("ODOO_ERROR")?prisma.odooMigrationError.findMany({where:{status:"OPEN"},take:limit,orderBy:{id:"asc"},select:{id:true,entity:true,externalId:true}}):[]
 ]);
 // Report saturation instead of silently dropping records from a source.
 if([docs,contracts,insurance,periods,steps,penalties,settlements,errors].some(r=>r.length>=limit))throw Error("HR event source exceeds configured batch capacity; split workload before activation");
 for(const d of docs)if(d.expiresAt)add("DOCUMENT",d.id,d.expiresAt.toISOString(),"مراجعة تجديد مستند "+d.type,d.expiresAt,d.employee.employeeNumber);
 for(const d of contracts)if(d.endDate)add("CONTRACT",d.id,d.endDate.toISOString(),"مراجعة تجديد عقد",d.endDate,d.employee.employeeNumber);
 for(const d of insurance)add("INSURANCE",d.id,d.endDate.toISOString(),"مراجعة تجديد التأمين الطبي",d.endDate,d.employee.employeeNumber);
 for(const d of periods)add("PAYROLL",d.id,d.endDate.toISOString(),"مراجعة جاهزية مسير الرواتب",d.endDate,d.name);
 for(const d of steps)if(d.step===d.workflowInstance.currentStep)add("APPROVAL",d.id,"pending","متابعة طلب معلق",null,d.workflowInstance.employee.employeeNumber);
 for(const d of penalties)add("PENALTY",d.id,"review","مراجعة جزاء مسجل دون أثر مالي جديد",null,d.employee.employeeNumber);
 for(const d of settlements)add("SETTLEMENT",d.id,"open","متابعة مخالصة غير مكتملة",d.terminationDate,d.employee.employeeNumber);
 for(const d of errors)add("ODOO_ERROR",d.id,"open","متابعة خطأ مزامنة Odoo",null,d.entity+" #"+d.externalId);
 const keyed=candidates.map(x=>({...x,key:hrEventKey(x.kind,x.id,x.version)}));
 const known=new Set<string>();
 for(let i=0;i<keyed.length;i+=500){const rows=await prisma.madarWorkTask.findMany({where:{occurrenceKey:{in:keyed.slice(i,i+500).map(x=>x.key)}},select:{occurrenceKey:true}});for(const row of rows)if(row.occurrenceKey)known.add(row.occurrenceKey);}
 const fresh=keyed.filter(x=>!known.has(x.key));
 let created=0;
 for(const item of fresh.slice(0,100)){
  const n=await prisma.$transaction(async tx=>{
   const currentOwner=await tx.employee.findFirst({where:{id:owner.id,...active,user:hrUser},select:{userId:true}});
   const currentReviewer=await tx.user.findFirst({where:{id:reviewer.id,...hrUser},select:{id:true}});
   if(!currentOwner?.userId||!currentReviewer||currentOwner.userId===currentReviewer.id)throw Error("HR task recipients changed");
   const current=await tx.madarWorkTask.findUnique({where:{occurrenceKey:item.key},select:{id:true}});if(current)return 0;
   const task=await tx.madarWorkTask.create({data:{employeeId:owner.id,createdById:reviewer.id,reviewerId:reviewer.id,groupKey:item.key,occurrenceKey:item.key,title:item.title.slice(0,180),description:"مرجع المتابعة: "+item.reference+"\nنوع الحدث: "+item.kind+"\nراجع السجل الأصلي قبل اتخاذ أي إجراء. لا يتضمن التكليف اعتماداً أو خصماً أو صرفاً.",priority:"HIGH",dueAt:eventDue(now,item.deadline,p.responseHours)}});
   await tx.notification.create({data:{userId:currentOwner.userId,title:"تكليف آلي للموارد البشرية",body:task.title,type:"WARNING",link:"/employee/tasks"}});
   await tx.auditLog.create({data:{action:"work-task:hr-event",entity:"MadarWorkTask",entityId:task.id,metadata:{kind:item.kind,sourceId:item.id,version:item.version,financialEffect:false}}});
   return 1;
  },{isolationLevel:"Serializable"});created+=n;
 }
 return {enabled:true,candidates:keyed.length,created,remaining:Math.max(0,fresh.length-created)};
}
