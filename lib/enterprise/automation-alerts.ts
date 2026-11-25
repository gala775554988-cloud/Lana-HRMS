import {prisma} from "@/lib/prisma";
import {automationPolicySchema,defaultAutomationPolicy,automationSettingKey,reminderKey,riyadhDay,isApprovalLate} from "./automation-rules";
import {parseWorkflowStepMetadata} from "./workflow-step-metadata";
import type {Prisma} from "@prisma/client";
export async function loadAutomationPolicy(){
 const row=await prisma.appSetting.findUnique({where:{key:automationSettingKey}});
 return row?automationPolicySchema.parse(row.value):defaultAutomationPolicy;
}
export async function runAutomationAlerts(now=new Date()){
 const policy=await loadAutomationPolicy();
 if(!policy.enabled)return {enabled:false,created:0,candidates:0};
 const hr=await prisma.user.findMany({where:{isActive:true,roles:{some:{role:{name:{in:["SUPER_ADMIN","HR_MANAGER"]}}}}},select:{id:true}});
 const admins=hr.map(u=>u.id),day=riyadhDay(now),until=new Date(now.getTime()+policy.noticeDays*86400000);
 const notices:Prisma.NotificationCreateManyInput[]=[];
 function add(rule:string,source:string,window:string,recipients:(string|null|undefined)[],title:string,body:string,link:string){
  for(const userId of new Set(recipients.filter((x):x is string=>Boolean(x))))notices.push({automationKey:reminderKey(rule,source,window,userId),userId,title,body,link,type:"WARNING"});
 }
 const limit=10001;
 const [docs,contracts,steps,open]=await Promise.all([
  policy.documents?prisma.employeeDocument.findMany({where:{status:"VERIFIED",expiresAt:{gte:now,lte:until},employee:{status:"ACTIVE",archivedAt:null}},take:limit,orderBy:{id:"asc"},select:{id:true,expiresAt:true,employee:{select:{userId:true,employeeNumber:true,user:{select:{isActive:true}}}}}}):[],
  policy.contracts?prisma.employeeContract.findMany({where:{status:"ACTIVE",endDate:{gte:now,lte:until},employee:{status:"ACTIVE",archivedAt:null}},take:limit,orderBy:{id:"asc"},select:{id:true,endDate:true,employee:{select:{userId:true,employeeNumber:true,user:{select:{isActive:true}}}}}}):[],
  policy.approvals?prisma.workflowStep.findMany({where:{status:"PENDING",approverUserId:{not:null},workflowInstance:{status:"PENDING"}},take:limit,orderBy:{id:"asc"},select:{id:true,step:true,comments:true,approverUserId:true,workflowInstance:{select:{id:true,currentStep:true,updatedAt:true}}}}):[],
  policy.syncErrors?prisma.odooMigrationError.count({where:{status:"OPEN"}}):0
 ]);
 if(docs.length>=limit||contracts.length>=limit||steps.length>=limit)throw Error("Automation source exceeds safe batch limit");
 for(const d of docs){if(!d.expiresAt)continue;const date=riyadhDay(d.expiresAt);const recipients=[...admins,d.employee.user?.isActive?d.employee.userId:null];add("document-expiry",d.id,date,recipients,"تنبيه قرب انتهاء مستند","موعد انتهاء مستند للموظف "+d.employee.employeeNumber+" بتاريخ "+date,"/employee/documents");}
 for(const d of contracts){if(!d.endDate)continue;const date=riyadhDay(d.endDate);add("contract-expiry",d.id,date,[...admins,d.employee.user?.isActive?d.employee.userId:null],"تنبيه قرب انتهاء عقد","موعد انتهاء عقد الموظف "+d.employee.employeeNumber+" بتاريخ "+date,"/employee/contracts");}
 const approverIds=[...new Set(steps.map(s=>s.approverUserId).filter((s):s is string=>Boolean(s)))];
 const activeApprovers=approverIds.length?await prisma.user.findMany({where:{id:{in:approverIds},isActive:true},select:{id:true}}):[];
 const active=new Set(activeApprovers.map(u=>u.id));
 for(const s of steps){
  if(s.step!==s.workflowInstance.currentStep)continue;
  const meta=parseWorkflowStepMetadata(s.comments);
  const hours=meta.slaHours??policy.escalationHours;
  if(!isApprovalLate(now,s.workflowInstance.updatedAt,hours,meta.deferredUntil))continue;
  add("approval-sla",s.id,day,[...admins,s.approverUserId&&active.has(s.approverUserId)?s.approverUserId:null],"طلب متأخر عن مدة الاعتماد","يوجد طلب معلق يحتاج مراجعة؛ لا يترتب على التنبيه أي خصم مالي.","/approvals?tab=inbox&highlight="+encodeURIComponent(s.workflowInstance.id));
 }
 if(open>0)add("odoo-failure","open-errors",day,admins,"أخطاء مزامنة مفتوحة","عدد سجلات Odoo المفتوحة وقت الفحص: "+open,"/automation-health");
 let created=0;
 for(let i=0;i<notices.length;i+=250){const result=await prisma.notification.createMany({data:notices.slice(i,i+250),skipDuplicates:true});created+=result.count;}
 return {enabled:true,created,candidates:notices.length,openErrors:open};
}
