// One-release operator bridge. Remove this route and its key after the authorized import.
import { NextResponse } from 'next/server';
import { createHash,timingSafeEqual,randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getPayrollOdooClient } from '@/lib/payroll/connection';
import { migrationConfigSchema } from '@/lib/integrations/odoo/migration/mapping';
import { createMigration,processMigrationStep,migrationStatus,retryMigrationRecord } from '@/lib/integrations/odoo/migration/worker';
import { expiresAt } from './expiry';
export const runtime='nodejs';export const maxDuration=300;
const digest=(value:string)=>createHash('sha256').update(value).digest();
const marker='payroll.release.refresh.v2';
async function snapshot(id:string){const job=await migrationStatus(id);return job?{id:job.id,status:job.status,phase:job.phase,processed:job.processed,imported:job.imported,updated:job.updated,skipped:job.skipped,failed:job.failed,openErrors:job.openErrors,progress:job.progress,lastError:job.lastError,errorCodes:job.errors.map(e=>({entity:e.entity,code:e.code,externalId:e.externalId}))}:null;}
export async function POST(request:Request){
 const key=process.env.LANA_PAYROLL_RELEASE_KEY;if(!key||!timingSafeEqual(digest(request.headers.get('x-lana-payroll-key')??''),digest(key)))return NextResponse.json({success:false},{status:401});
 if(Date.now()>new Date(expiresAt).getTime())return NextResponse.json({success:false,expired:true},{status:410});
 if(process.env.VERCEL_ENV!=='production')return NextResponse.json({success:false},{status:403});
 const body=await request.json().catch(()=>null);if(!['inspect','start','step','status','retry-errors','diagnostics'].includes(body?.action))return NextResponse.json({success:false},{status:400});
 try{
  if(body.action==='diagnostics'){
   const {client}=await getPayrollOdooClient();const meta=await client.fieldsGet('hr.salary.rule');const fields=['id','code','category_id','sequence','amount_python_compute','appears_on_payslip','not_computed_in_net'].filter(name=>name in meta);const rules=await client.search_read('hr.salary.rule',[],fields,{limit:500,order:'id asc',context:{active_test:false}});const localRules=await prisma.salaryRule.findMany({select:{code:true,category:true,isActive:true}});return NextResponse.json({success:true,rules,localRules},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='inspect'){
   const {client}=await getPayrollOdooClient();const summary:Record<string,unknown>={};
   for(const model of ['hr.contract','hr.payslip','hr.payslip.line','hr.salary.rule']){try{const fields=await client.fieldsGet(model);const count=await client.execute_kw<number>(model,'search_count',[[]],{context:{active_test:false}});summary[model]={available:true,count,fields:Object.keys(fields).filter(name=>/wage|salary|allowance|currency|amount|total|category|rate|quantity|date_from/.test(name))};}catch{summary[model]={available:false};}}
   const states=await client.execute_kw('hr.contract','read_group',[[],['state'],['state']],{context:{active_test:false}}).catch(()=>[]);const rules=await client.search_read('hr.salary.rule',[],['id','code','category_id'],{limit:500,order:'id asc',context:{active_test:false}}).catch(()=>[]);const categories=await client.search_read('hr.salary.rule.category',[],['id','code','parent_id'],{limit:500,order:'id asc',context:{active_test:false}}).catch(()=>[]);return NextResponse.json({success:true,source:summary,contractStates:states,salaryRules:rules,salaryCategories:categories,local:{contracts:await prisma.employeeContract.count(),historicalPayslips:await prisma.historicalPayslip.count(),linkedEmployees:await prisma.employee.count({where:{odooId:{not:null}}}),contractCurrencies:await prisma.employeeContract.groupBy({by:['currency'],_count:{_all:true}})}},{headers:{'Cache-Control':'no-store'}});
  }
  let saved=await prisma.appSetting.findUnique({where:{key:marker}});let jobId=typeof saved?.value==='string'?saved.value:null;
  if(body.action==='start'&&!jobId){
   const user=await prisma.user.create({data:{username:`payroll-import-service-${randomUUID()}`,name:'خدمة استيراد الرواتب — تنفيذ مفوض',isActive:false,passwordHash:null}});
   const job=await createMigration(migrationConfigSchema.parse({scope:'PAYROLL'}),user.id).catch(async error=>{await prisma.user.delete({where:{id:user.id}});throw error;});jobId=job.id;
   await prisma.appSetting.create({data:{key:marker,value:job.id,description:'Authorized one-release payroll import; inactive audit service identity'}});
   await prisma.auditLog.create({data:{actorUserId:user.id,action:'payroll:authorized-release-import',entity:'odooMigrationJob',entityId:job.id,metadata:{scope:'CONTRACTS_AND_HISTORICAL_PAYROLL',outboundWrites:false,interactiveAccount:false}}});
   saved=await prisma.appSetting.findUnique({where:{key:marker}});
  }
  if(!jobId)return NextResponse.json({success:false,error:'JOB_NOT_STARTED'},{status:409});
  const job=await prisma.odooMigrationJob.findUniqueOrThrow({where:{id:jobId}});if((job.config as {scope?:string}).scope!=='PAYROLL')return NextResponse.json({success:false},{status:403});
  if(body.action==='retry-errors'&&['COMPLETED','COMPLETED_WITH_ERRORS','FAILED','PAUSED'].includes(job.status)){const errors=await prisma.odooMigrationError.findMany({where:{jobId:job.id,status:'OPEN',entity:{in:['CONTRACTS','PAYROLL']}},orderBy:{updatedAt:'asc'},take:20});for(const error of errors){try{await retryMigrationRecord(job.id,error.id);}catch{}}}
  if(body.action==='step'&&['PENDING','RUNNING'].includes(job.status))await processMigrationStep(job.id);
  return NextResponse.json({success:true,job:await snapshot(job.id)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({success:false,error:'PAYROLL_IMPORT_FAILED',job:typeof (await prisma.appSetting.findUnique({where:{key:marker}}))?.value==='string'?await snapshot(String((await prisma.appSetting.findUnique({where:{key:marker}}))!.value)):null},{status:409});}
}
