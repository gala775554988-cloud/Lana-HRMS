import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPayrollOdooClient } from "@/lib/payroll/connection";
import { odooPayrollSource } from "@/lib/payroll/odoo-payroll";
import { migrationConfigSchema, nextMonth, MigrationRecordError, type MigrationConfig } from "./mapping";
import { employeeBatch, managersBatch, loanBatch, payrollBatch, type ImportContext, type Outcome } from "./importers";
import { requiredFields } from "./reader";
import type { OdooDomain, OdooRecord } from "../types";
export const phases=["EMPLOYEES","MANAGERS","LOANS","PAYROLL"] as const;
const active=["PENDING","RUNNING","PAUSED"];
export async function createMigration(config:MigrationConfig,actorUserId:string) {
  config={...config,toMonth:config.toMonth??new Date().toISOString().slice(0,7)};
  const {client}=await getPayrollOdooClient(config.connectionId);const remote=client.getConfig();const source=odooPayrollSource(remote.url,remote.database);
  return prisma.$transaction(async tx=>{
    const binding=await tx.appSetting.findUnique({where:{key:"odoo.migration.employeeSource"}});
    if(binding&&binding.value!==source)throw new MigrationRecordError("SOURCE_CONFLICT","مصدر الموظفين مربوط باتصال آخر؛ يلزم مراجعة المطابقة قبل تغيير المصدر");
    if(!binding)await tx.appSetting.create({data:{key:"odoo.migration.employeeSource",value:source}});
    if(await tx.odooMigrationJob.findFirst({where:{source,status:{in:active}}}))throw new MigrationRecordError("JOB_ACTIVE","يوجد تشغيل نشط أو متوقف مؤقتاً لهذا المصدر؛ استأنفه أو ألغِه أولاً");
    const job=await tx.odooMigrationJob.create({data:{source,connectionId:config.connectionId,actorUserId,config:JSON.parse(JSON.stringify(config))}});
    await tx.auditLog.create({data:{actorUserId,action:"odoo-migration:start",entity:"odooMigrationJob",entityId:job.id,metadata:{source}}});return job;
  },{isolationLevel:"Serializable"});
}
async function phaseReader(context:ImportContext,phase:string) {
  if(phase==="EMPLOYEES"||phase==="MANAGERS") {
    const configured=[context.config.employeeNumberField,context.config.nationalIdField,context.config.hireDateField,...(context.config.employeeStatusField?[context.config.employeeStatusField]:[])];
    const info=await requiredFields(context.client,"hr.employee",["id","name","active","write_date",...configured],["work_email","work_phone","mobile_phone","department_id","job_id","company_id","country_id","marital","parent_id","departure_date","departure_reason_id"]);
    return {model:"hr.employee",fields:info.fields};
  }
  if(phase==="LOANS") {const info=await requiredFields(context.client,context.config.loanModel,["id","write_date",...Object.values(context.config.loanFields)],["company_id","name","payment_date","installment","total_paid_amount","loan_type_id"]);return {model:context.config.loanModel,fields:info.fields};}
  const info=await requiredFields(context.client,"hr.payslip",["id","employee_id","date_from","date_to","write_date"]);return {model:"hr.payslip",fields:info.fields};
}
function phaseDomain(config:MigrationConfig,phase:string,month?:string|null):OdooDomain {
  if(phase!=="PAYROLL")return [];
  const from=month??config.fromMonth;const through=month?nextMonth(month):config.toMonth?nextMonth(config.toMonth):null;
  return [...(from?[["date_from",">=",`${from}-01`]]:[]),...(through?[["date_from","<",`${through}-01`]]:[])] as OdooDomain;
}
async function prepare(context:ImportContext,phase:string,rows:OdooRecord[]) {
  if(phase==="EMPLOYEES")return employeeBatch(context,rows);
  if(phase==="MANAGERS")return managersBatch(context,rows);
  if(phase==="LOANS")return loanBatch(context,rows);
  return payrollBatch(context,rows);
}
function safeError(error:unknown) {
  if(error instanceof MigrationRecordError)return {code:error.code,message:error.message};
  const code=typeof error==="object"&&error!==null&&"code" in error?String(error.code):"";
  if(code==="P2002")return {code:"DUPLICATE_RECORD",message:"تعارض مفتاح فريد؛ لم تُدمج السجلات أو تُستبدل تلقائياً"};
  return {code:"SOURCE_OR_DATABASE_ERROR",message:"فشل الوصول أو الحفظ؛ تحقق من الاتصال والصلاحيات والمطابقة ثم أعد المحاولة"};
}
async function recordFailure(jobId:string,entity:string,externalId:number,error:unknown) {
  const safe=safeError(error);
  await prisma.odooMigrationError.upsert({where:{jobId_entity_externalId:{jobId,entity,externalId}},create:{jobId,entity,externalId,...safe},update:{...safe,status:"OPEN",attempts:{increment:1}}});
}
async function jobContext(jobId:string) {
  const job=await prisma.odooMigrationJob.findUniqueOrThrow({where:{id:jobId}});const config=migrationConfigSchema.parse(job.config);
  const {client}=await getPayrollOdooClient(config.connectionId);const remote=client.getConfig();if(odooPayrollSource(remote.url,remote.database)!==job.source)throw new MigrationRecordError("SOURCE_CHANGED","إعداد الاتصال يشير لمصدر مختلف؛ لن يستكمل هذا التشغيل عليه");
  return {job,context:{source:job.source,config,client,actorUserId:job.actorUserId}};
}
export async function processMigrationStep(jobId:string) {
  const token=randomUUID();const now=new Date();
  const claim=await prisma.odooMigrationJob.updateMany({where:{id:jobId,status:{in:["PENDING","RUNNING"]},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},data:{status:"RUNNING",leaseToken:token,leaseUntil:new Date(now.getTime()+10*60000),lastError:null}});
  if(claim.count!==1)throw new MigrationRecordError("JOB_BUSY","التشغيل مشغول أو متوقف؛ حدّث حالته أو استأنفه");
  const started=Date.now();
  try {
    const {job,context}=await jobContext(jobId);Object.assign(context,{jobId,leaseToken:token});
    const read=await phaseReader(context,job.phase);
    let upperId=job.upperId;let phaseTotal=job.phaseTotal;let month=job.month;
    if(upperId===null) {
      const domain=phaseDomain(context.config,job.phase);
      const last=(await context.client.search_read(read.model,domain,["id"],{limit:1,order:"id desc",context:{active_test:false}}))[0];upperId=Number(last?.id??0);
      phaseTotal=await context.client.execute_kw<number>(read.model,"search_count",[[...domain,["id","<=",upperId]]],{context:{active_test:false}});
      if(!Number.isSafeInteger(phaseTotal)||phaseTotal<0)throw new MigrationRecordError("INVALID_COUNT","عدد سجلات المصدر غير صالح");
      if(job.phase==="PAYROLL") {const first=(await context.client.search_read(read.model,[...domain,["id","<=",upperId]],["date_from"],{limit:1,order:"date_from asc,id asc",context:{active_test:false}}))[0];month=first?String(first.date_from).slice(0,7):context.config.toMonth??new Date().toISOString().slice(0,7);}
    }
    const domain:OdooDomain=[...phaseDomain(context.config,job.phase,month),["id",">",job.cursor],["id","<=",upperId]];
    const rows=await context.client.search_read(read.model,domain,read.fields,{limit:500,order:"id asc",context:{active_test:false}});
    if(rows.some((row,index)=>!Number.isSafeInteger(Number(row.id))||Number(row.id)>upperId!||Number(row.id)<=(index?Number(rows[index-1].id):job.cursor)))throw new MigrationRecordError("INVALID_CURSOR","ترتيب معرفات المصدر غير صالح");
    const importRow=rows.length?await prepare(context,job.phase,rows):null;
    let cursor=job.cursor,processed=0,imported=0,updated=0,skipped=0,lastWriteDate=job.lastWriteDate;
    for(const row of rows) {
      if(Date.now()-started>200000)break;
      const lease=await prisma.odooMigrationJob.findFirst({where:{id:jobId,status:"RUNNING",leaseToken:token},select:{id:true}});if(!lease)break;
      try {
        const outcome:Outcome=await importRow!(row);
        if(outcome==="IMPORTED")imported++;else if(outcome==="UPDATED")updated++;else skipped++;
        await prisma.odooMigrationError.updateMany({where:{jobId,entity:job.phase,externalId:Number(row.id),status:"OPEN"},data:{status:"RESOLVED"}});
      } catch(error) {await recordFailure(jobId,job.phase,Number(row.id),error);skipped++;}
      cursor=Number(row.id);processed++;if(typeof row.write_date==="string"&&(!lastWriteDate||row.write_date>lastWriteDate))lastWriteDate=row.write_date;
    }
    const exhausted=processed===rows.length&&rows.length<500;
    let nextPhase=job.phase,nextCursor=cursor,nextMonthValue=month,nextUpper:number|null=upperId,nextPhaseTotal=phaseTotal,nextProcessed=job.phaseProcessed+processed,status="RUNNING";
    if(exhausted) {
      if(job.phase==="PAYROLL"&&month) {
        const next=nextMonth(month);const end=context.config.toMonth??new Date().toISOString().slice(0,7);
        if(next<=end&&nextProcessed<phaseTotal){nextMonthValue=next;nextCursor=0;}else status="COMPLETED";
      } else {
        const index=phases.indexOf(job.phase as typeof phases[number]);nextPhase=phases[index+1]??"PAYROLL";nextCursor=0;nextUpper=null;nextMonthValue=null;nextPhaseTotal=0;nextProcessed=0;
      }
    }
    if(exhausted&&((job.phase!=="PAYROLL")||status==="COMPLETED")&&job.phaseProcessed+processed!==phaseTotal)throw new MigrationRecordError("SOURCE_COUNT_CHANGED","تغير عدد سجلات المصدر أثناء التشغيل؛ راجع المصدر وابدأ تشغيل تحقق جديداً لإعادة المطابقة");
    const failures=await prisma.odooMigrationError.count({where:{jobId,status:"OPEN"}});if(status==="COMPLETED"&&failures)status="COMPLETED_WITH_ERRORS";
    await prisma.$transaction(async tx=>{
      const changed=await tx.odooMigrationJob.updateMany({where:{id:jobId,status:"RUNNING",leaseToken:token},data:{status,phase:nextPhase,cursor:nextCursor,upperId:nextUpper,month:nextMonthValue,phaseTotal:nextPhaseTotal,phaseProcessed:nextProcessed,processed:{increment:processed},imported:{increment:imported},updated:{increment:updated},skipped:{increment:skipped},failed:failures,page:{increment:1},lastWriteDate,leaseToken:null,leaseUntil:null,finishedAt:status.startsWith("COMPLETED")?new Date():null}});
      if(changed.count!==1)throw new MigrationRecordError("LEASE_LOST","توقف العامل أو انتهت ملكية التشغيل؛ يمكن استئنافه بأمان");
      await tx.auditLog.create({data:{actorUserId:job.actorUserId,action:"odoo-migration:batch",entity:"odooMigrationJob",entityId:jobId,metadata:{phase:job.phase,page:job.page+1,lastOdooId:cursor,imported,updated,skipped,failed:failures,month}}});
    });
  } catch(error) {
    const safe=safeError(error);await prisma.odooMigrationJob.updateMany({where:{id:jobId,leaseToken:token},data:{status:"FAILED",lastError:`${safe.code}: ${safe.message}`,leaseToken:null,leaseUntil:null}});throw new MigrationRecordError(safe.code,safe.message);
  }
  return prisma.odooMigrationJob.findUniqueOrThrow({where:{id:jobId}});
}
export async function retryMigrationRecord(jobId:string,errorId:string) {
  const token=randomUUID();const claimed=await prisma.odooMigrationJob.updateMany({where:{id:jobId,status:{in:["FAILED","COMPLETED","COMPLETED_WITH_ERRORS","PAUSED"]},OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]},data:{leaseToken:token,leaseUntil:new Date(Date.now()+10*60000)}});
  if(claimed.count!==1)throw new MigrationRecordError("JOB_BUSY","أوقف التشغيل مؤقتاً قبل إعادة محاولة السجل");
  try {
    const {job,context}=await jobContext(jobId);Object.assign(context,{jobId,leaseToken:token,retry:true});
    const failure=await prisma.odooMigrationError.findFirst({where:{id:errorId,jobId,status:"OPEN"}});if(!failure)throw new MigrationRecordError("ERROR_MISSING","السجل محل المحاولة غير متاح");
    const reader=await phaseReader(context,failure.entity);
    const rows=await context.client.read(reader.model,[failure.externalId],reader.fields,{context:{active_test:false}});
    if(!rows.length)throw new MigrationRecordError("SOURCE_MISSING","السجل لم يعد متاحاً في المصدر");
    try {
      const importer=await prepare(context,failure.entity,rows);const outcome=await importer(rows[0]);
      await prisma.odooMigrationError.update({where:{id:errorId},data:{status:"RESOLVED",attempts:{increment:1}}});
      const remaining=await prisma.odooMigrationError.count({where:{jobId,status:"OPEN"}});
      await prisma.odooMigrationJob.update({where:{id:jobId},data:{failed:remaining,...(outcome!=="UNCHANGED"&&job.skipped>0?{skipped:{decrement:1}}:{}),...(outcome==="IMPORTED"?{imported:{increment:1}}:outcome==="UPDATED"?{updated:{increment:1}}:{}),status:job.status==="COMPLETED_WITH_ERRORS"&&remaining===0?"COMPLETED":job.status}});
      await prisma.auditLog.create({data:{actorUserId:job.actorUserId,action:"odoo-migration:retry",entity:"odooMigrationJob",entityId:jobId,metadata:{entity:failure.entity,externalId:failure.externalId,outcome}}});
    } catch(error) {await recordFailure(jobId,failure.entity,failure.externalId,error);throw error;}
  } finally {await prisma.odooMigrationJob.updateMany({where:{id:jobId,leaseToken:token},data:{leaseToken:null,leaseUntil:null}});}
}
export async function controlMigration(jobId:string,action:"pause"|"resume"|"cancel",actorUserId:string) {
  const allowed=action==="resume"?["PAUSED","FAILED"]:["PENDING","RUNNING","PAUSED","FAILED"];
  const changed=await prisma.odooMigrationJob.updateMany({where:{id:jobId,status:{in:allowed},...(action==="resume"?{OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]}:{})},data:{status:action==="resume"?"PENDING":action==="cancel"?"CANCELLED":"PAUSED",leaseToken:null,leaseUntil:null}});
  if(changed.count!==1)throw new MigrationRecordError("INVALID_ACTION","الإجراء غير متاح لحالة التشغيل");
  await prisma.auditLog.create({data:{actorUserId,action:`odoo-migration:${action}`,entity:"odooMigrationJob",entityId:jobId}});
}
export async function migrationStatus(id:string) {
  const job=await prisma.odooMigrationJob.findUnique({where:{id}});if(!job)return null;
  const [errors,openErrors]=await Promise.all([prisma.odooMigrationError.findMany({where:{jobId:id,status:"OPEN"},orderBy:{updatedAt:"desc"},take:50}),prisma.odooMigrationError.count({where:{jobId:id,status:"OPEN"}})]);
  const phaseIndex=phases.indexOf(job.phase as typeof phases[number]);const completed=job.status.startsWith("COMPLETED");
  return {...job,leaseToken:undefined,errors,openErrors,progress:completed?100:Math.min(99,Math.floor((Math.max(0,phaseIndex)+Math.min(1,job.phaseTotal?job.phaseProcessed/job.phaseTotal:0))/phases.length*100)),successRate:job.processed?Math.max(0,Math.round((job.processed-openErrors)/job.processed*10000)/100):0};
}
