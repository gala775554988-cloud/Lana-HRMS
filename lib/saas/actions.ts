'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getSaasSuite } from "@/lib/saas/catalog";

async function requireSaas(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}
function parseJson(v: FormDataEntryValue | null) { const s=String(v??"").trim(); if(!s) return {}; try{return JSON.parse(s) as Record<string,unknown>;}catch{return { text:s };} }
function validate(suite:string, feature:string){ const meta=getSaasSuite(suite); if(!meta||!meta.features.includes(feature as never)) throw new Error("Unknown SaaS feature"); return meta; }

export async function listSaasRecords(suite:string, feature:string, search=""){
  await requireSaas("read"); validate(suite,feature); const needle=search?{contains:search,mode:"insensitive" as const}:undefined;
  switch(suite){
    case "saas-billing":
      if(feature==="subscription-plans") return prisma.saasPlan.findMany({where:search?{OR:[{code:needle},{name:needle},{currency:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
      if(feature==="invoices") return prisma.saasInvoice.findMany({where:search?{OR:[{invoiceNumber:needle},{status:needle},{currency:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
      if(feature==="payments") return prisma.saasPayment.findMany({where:search?{OR:[{provider:needle},{status:needle},{reference:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
      if(feature==="coupons") return prisma.saasCoupon.findMany({where:search?{OR:[{code:needle},{type:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
      if(feature==="usage-billing") return prisma.saasUsageRecord.findMany({where:search?{OR:[{metric:needle},{period:needle},{unit:needle}]}:{},orderBy:{createdAt:"desc"},take:100});
      if(feature==="license-management") return prisma.saasLicense.findMany({where:search?{OR:[{key:needle},{product:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
      break;
    case "deployment-center": return prisma.deploymentCenterRecord.findMany({where:search?{OR:[{environment:needle},{releaseVersion:needle},{channel:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "backup-center": return prisma.backupCenterRecord.findMany({where:search?{OR:[{type:needle},{provider:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "disaster-recovery": return prisma.disasterRecoveryRecord.findMany({where:search?{OR:[{code:needle},{name:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "observability": return prisma.observabilityRecord.findMany({where:search?{OR:[{type:needle},{source:needle},{message:needle},{severity:needle}]}:{},orderBy:{createdAt:"desc"},take:100});
    case "compliance-center": return prisma.complianceControl.findMany({where:search?{OR:[{framework:needle},{controlCode:needle},{title:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "localization": return prisma.localizationRecord.findMany({where:search?{OR:[{locale:needle},{namespace:needle},{key:needle},{value:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "mobile-platform": return prisma.mobilePlatformRecord.findMany({where:search?{OR:[{deviceId:needle},{platform:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "data-warehouse": return prisma.dataWarehouseRecord.findMany({where:search?{OR:[{pipeline:needle},{layer:needle},{dataset:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "enterprise-automation": return prisma.automationRecord.findMany({where:search?{OR:[{code:needle},{name:needle},{triggerType:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "quality": return prisma.qualityRecord.findMany({where:search?{OR:[{suite:needle},{testType:needle},{name:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
  }
  return prisma.saasPlatformRecord.findMany({where:{suite,feature,...(search?{OR:[{code:needle},{name:needle},{status:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
}

export async function saveSaasRecord(formData:FormData){
  const session=await requireSaas("manage"); const suite=String(formData.get("suite")); const feature=String(formData.get("feature")); validate(suite,feature); const code=String(formData.get("code")||Date.now()).trim(); const name=String(formData.get("name")||code).trim(); const payload=parseJson(formData.get("payload"));
  switch(suite){
    case "saas-billing":
      if(feature==="subscription-plans"){await prisma.saasPlan.upsert({where:{code},update:{name,price:String((payload as any).price??0) as any,quotas:payload as any,features:payload as any},create:{code,name,price:String((payload as any).price??0) as any,quotas:payload as any,features:payload as any}});break;}
      if(feature==="coupons"){await prisma.saasCoupon.upsert({where:{code},update:{type:String((payload as any).type||"PERCENT"),value:String((payload as any).value??0) as any},create:{code,type:String((payload as any).type||"PERCENT"),value:String((payload as any).value??0) as any}});break;}
      if(feature==="license-management"){await prisma.saasLicense.upsert({where:{key:code},update:{product:name,seats:Number((payload as any).seats||1),metadata:payload as any},create:{key:code,product:name,seats:Number((payload as any).seats||1),metadata:payload as any}});break;}
      if(feature==="usage-billing"){await prisma.saasUsageRecord.create({data:{metric:code,quantity:Number((payload as any).quantity||1),unit:String((payload as any).unit||"unit"),period:String((payload as any).period||new Date().toISOString().slice(0,7)),metadata:payload as any}});break;}
      break;
    case "deployment-center": await prisma.deploymentCenterRecord.create({data:{environment:code,releaseVersion:name,channel:String((payload as any).channel||"stable"),strategy:String((payload as any).strategy||"blue-green"),featureFlags:payload as any}}); break;
    case "backup-center": await prisma.backupCenterRecord.create({data:{type:feature,provider:String((payload as any).provider||"s3"),location:String((payload as any).location||code),metadata:payload as any}}); break;
    case "disaster-recovery": await prisma.disasterRecoveryRecord.upsert({where:{code},update:{name,replication:payload as any,failover:payload as any},create:{code,name,rpoMinutes:Number((payload as any).rpoMinutes||15),rtoMinutes:Number((payload as any).rtoMinutes||60),replication:payload as any,failover:payload as any}}); break;
    case "observability": await prisma.observabilityRecord.create({data:{type:feature,source:code,message:name,metadata:payload as any,metricValue:Number((payload as any).value||0)}}); break;
    case "compliance-center": await prisma.complianceControl.upsert({where:{framework_controlCode:{framework:feature.toUpperCase(),controlCode:code}},update:{title:name,evidence:payload as any},create:{framework:feature.toUpperCase(),controlCode:code,title:name,evidence:payload as any}}); break;
    case "localization": await prisma.localizationRecord.upsert({where:{locale_namespace_key:{locale:String((payload as any).locale||"ar"),namespace:feature,key:code}},update:{value:name,direction:String((payload as any).direction||"RTL")},create:{locale:String((payload as any).locale||"ar"),namespace:feature,key:code,value:name,direction:String((payload as any).direction||"RTL"),currency:String((payload as any).currency||"SAR"),timezone:String((payload as any).timezone||"Asia/Riyadh")}}); break;
    case "mobile-platform": await prisma.mobilePlatformRecord.upsert({where:{deviceId:code},update:{platform:name,metadata:payload as any},create:{deviceId:code,platform:name,metadata:payload as any,biometricEnabled:Boolean((payload as any).biometricEnabled)}}); break;
    case "data-warehouse": await prisma.dataWarehouseRecord.create({data:{pipeline:feature,layer:String((payload as any).layer||"silver"),dataset:code,schemaJson:payload as any,metrics:payload as any,rowsCount:Number((payload as any).rowsCount||0)}}); break;
    case "enterprise-automation": await prisma.automationRecord.upsert({where:{code},update:{name,nodes:payload as any,edges:payload as any},create:{code,name,triggerType:feature,nodes:payload as any,edges:payload as any,bpmn:payload as any}}); break;
    case "quality": await prisma.qualityRecord.create({data:{suite:feature,testType:code,name,status:String((payload as any).status||"PASSED"),result:payload as any,executedAt:new Date()}}); break;
  }
  if(!["saas-billing","deployment-center","backup-center","disaster-recovery","observability","compliance-center","localization","mobile-platform","data-warehouse","enterprise-automation","quality"].includes(suite)){
    const existing=await prisma.saasPlatformRecord.findFirst({where:{tenantId:null,suite,feature,code}});
    if(existing) await prisma.saasPlatformRecord.update({where:{id:existing.id},data:{name,payload:payload as any,status:String(formData.get("status")||"ACTIVE")}});
    else await prisma.saasPlatformRecord.create({data:{suite,feature,code,name,payload:payload as any,status:String(formData.get("status")||"ACTIVE"),createdById:session.user.id}});
  }
  await prisma.auditLog.create({data:{actorUserId:session.user.id,action:"saas:save",entity:`${suite}/${feature}`,entityId:code,metadata:payload as any}}).catch(()=>null); revalidatePath(`/saas-platform/${suite}/${feature}`);
}

export async function deleteSaasRecord(formData:FormData){ await requireSaas("manage"); const id=String(formData.get("id")); const model=String(formData.get("model")||"saasPlatformRecord"); await (prisma as any)[model].delete({where:{id}}); revalidatePath(`/saas-platform/${String(formData.get("suite"))}/${String(formData.get("feature"))}`); }
export async function saasMetrics(){ await requireSaas("read"); const counts=await Promise.all([prisma.saasPlatformRecord.count().catch(()=>0),prisma.saasPlan.count().catch(()=>0),prisma.deploymentCenterRecord.count().catch(()=>0),prisma.backupCenterRecord.count().catch(()=>0),prisma.observabilityRecord.count().catch(()=>0),prisma.complianceControl.count().catch(()=>0),prisma.mobilePlatformRecord.count().catch(()=>0),prisma.dataWarehouseRecord.count().catch(()=>0),prisma.automationRecord.count().catch(()=>0),prisma.qualityRecord.count().catch(()=>0)]); return counts.reduce((a,b)=>a+b,0); }
