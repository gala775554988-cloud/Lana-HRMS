import { prisma } from '@/lib/prisma';
import type { OdooClient } from '@/lib/integrations/odoo/client';
import { readAll } from '@/lib/integrations/odoo/migration/reader';
import { externalId } from '@/lib/integrations/odoo/migration/mapping';
export function categoryFromOdoo(code:string,chain:string[],notInNet=false){
 const name=code.toUpperCase();if(['BASIC','GROSS','NET'].includes(name))return name;
 const categories=chain.map(value=>value.toUpperCase());
 if(categories.some(value=>['DED','DEDUCTION'].includes(value)))return 'DEDUCTION';
 if(categories.some(value=>['ALW','ALLOWANCE'].includes(value)))return 'ALLOWANCE';
 if(categories.some(value=>['COMP','EMPLOYER','COMPANY'].includes(value)))return 'EMPLOYER';
 if(notInNet)return 'INFORMATION';return null;
}
export async function discoverSalaryRules(client:OdooClient,actorUserId:string){
 let metadata:Awaited<ReturnType<OdooClient['fieldsGet']>>;
 try{metadata=await client.fieldsGet('hr.salary.rule');}catch{return {available:false,created:0,unmapped:[] as string[]};}
 if(!metadata.code||!metadata.category_id)return {available:false,created:0,unmapped:[] as string[]};
 const [categories,rules]=await Promise.all([readAll(client,'hr.salary.rule.category',[],['id','code','parent_id']),readAll(client,'hr.salary.rule',[],['id','code','name','category_id',...(metadata.not_computed_in_net?['not_computed_in_net']:[])])]);
 const byId=new Map(categories.map(row=>[Number(row.id),row]));const existing=new Set((await prisma.salaryRule.findMany({select:{code:true}})).map(row=>row.code));const unmapped:string[]=[];let created=0;
 for(const rule of rules){const code=String(rule.code??'');if(!code||existing.has(code))continue;const chain:string[]=[];const seen=new Set<number>();let id=externalId(rule.category_id);while(id&&!seen.has(id)){seen.add(id);const category=byId.get(id);if(!category)break;chain.push(String(category.code));id=externalId(category.parent_id);}
  const category=categoryFromOdoo(code,chain,rule.not_computed_in_net===true);if(!category){unmapped.push(code);continue;}
  await prisma.salaryRule.upsert({where:{code},create:{code,name:String(rule.name??code),category,isActive:true},update:{}});existing.add(code);created++;
 }
 await prisma.auditLog.create({data:{actorUserId,action:'payroll:discover-source-rules',entity:'salaryRule',metadata:{created,unmappedCount:unmapped.length,basis:'Odoo category ancestry; existing local rules preserved'}}});
 return {available:true,created,unmapped};
}
