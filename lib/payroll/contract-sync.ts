import { prisma } from '@/lib/prisma';
import type { OdooRecord } from '@/lib/integrations/odoo/types';
import { discoverContractFields,salaryProfileFromOdooContract } from '@/lib/integrations/odoo/contract-salary';
import { currencyCode } from '@/lib/integrations/odoo/migration/reader';
import { externalId,sourceDate,MigrationRecordError } from '@/lib/integrations/odoo/migration/mapping';
import { stage,type ImportContext,type Outcome } from '@/lib/integrations/odoo/migration/importers';
export async function contractBatch(context:ImportContext,rows:OdooRecord[]){
 const ids=rows.map(row=>externalId(row.employee_id)).filter((v):v is number=>v!==null);
 const [employees,contracts,metadata]=await Promise.all([prisma.employee.findMany({where:{odooId:{in:ids}},select:{id:true,odooId:true}}),prisma.employeeContract.findMany({where:{OR:[{odooId:{in:rows.map(r=>Number(r.id))}},{contractNumber:{in:rows.map(r=>`ODOO-CONT-${r.id}`)}}]},select:{id:true,odooId:true,employeeId:true,contractNumber:true}}),context.client.fieldsGet('hr.contract')]);
 const currencies=new Map<string,Promise<string>>();
 const employeeMap=new Map(employees.map(row=>[row.odooId,row.id]));
 return async(row:OdooRecord):Promise<Outcome>=>{
  const staged=await stage(context,'CONTRACTS',row);const employeeId=employeeMap.get(externalId(row.employee_id));if(!employeeId)throw new MigrationRecordError('EMPLOYEE_NOT_MAPPED','لم تتم مطابقة موظف العقد');
  const currencyKey=JSON.stringify([row.currency_id,row.company_id]);if(!currencies.has(currencyKey))currencies.set(currencyKey,currencyCode(context.client,row));const currency=await currencies.get(currencyKey)!;const profile=salaryProfileFromOdooContract(row);
  if(profile.salaryBase===undefined||profile.salaryBase<0)throw new MigrationRecordError('MISSING_CONTRACT_WAGE','راتب العقد الأساسي غير صالح');
  const status=({open:'ACTIVE',close:'EXPIRED',cancel:'TERMINATED',draft:'DRAFT'} as const)[String(row.state) as 'open'];if(!status)throw new MigrationRecordError('UNMAPPED_CONTRACT_STATE','حالة العقد تحتاج مراجعة');
  const start=sourceDate(row.date_start);const existing=contracts.find(c=>c.odooId===Number(row.id)||c.contractNumber===`ODOO-CONT-${row.id}`);
  if(existing&&existing.employeeId!==employeeId)throw new MigrationRecordError('CONTRACT_OWNER_CONFLICT','العقد مرتبط بموظف آخر؛ لن يُعاد ربطه تلقائيًا');
  const currentFields=discoverContractFields(metadata).filter(key=>typeof row[key]==='number'&&/(wage|salary|allowance|housing|transport|food|communication|bonus|deduction|overtime|insurance)/i.test(key)).map(name=>({name,label:String(metadata[name]?.string??name),value:row[name]}));
  await prisma.$transaction(async tx=>{
   if(context.jobId){const fenced=await tx.odooMigrationJob.updateMany({where:{id:context.jobId,leaseToken:context.leaseToken,leaseUntil:{gt:new Date()}},data:{leaseUntil:new Date(Date.now()+600000)}});if(fenced.count!==1)throw new MigrationRecordError('LEASE_LOST','تغير تشغيل المزامنة');}
   const data={employeeId,title:typeof row.name==='string'?row.name:`عقد Odoo #${row.id}`,startDate:start,endDate:row.date_end?sourceDate(row.date_end):null,salaryAmount:profile.salaryBase!,currency,status,odooId:Number(row.id),odooWriteDate:row.write_date?sourceDate(row.write_date):null};
   const saved=existing?await tx.employeeContract.update({where:{id:existing.id},data}):await tx.employeeContract.create({data:{...data,contractNumber:`ODOO-CONT-${row.id}`}});
   if(status==='ACTIVE'){
    const key=`odoo.compensation.${employeeId}`;const old=await tx.appSetting.findUnique({where:{key}});const previous=old?.value as {startDate?:string;contractId?:number}|null;
    if(!previous?.startDate||previous.startDate<=String(row.date_start)){
     const value=JSON.parse(JSON.stringify({source:'ODOO',profile,currency,contractId:Number(row.id),startDate:String(row.date_start),syncedAt:new Date().toISOString(),writeDate:row.write_date,fields:currentFields}));
     await tx.appSetting.upsert({where:{key},create:{key,value},update:{value}});
    }
   }
   if(status!=='ACTIVE'){const key=`odoo.compensation.${employeeId}`;const old=await tx.appSetting.findUnique({where:{key}});if((old?.value as {contractId?:number}|null)?.contractId===Number(row.id))await tx.appSetting.delete({where:{key}});}
   await tx.odooSourceRecord.update({where:staged.where,data:{status:'IMPORTED',localId:saved.id}});
  });
  return existing?'UPDATED':'IMPORTED';
 };
}
