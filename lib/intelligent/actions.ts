'use server';

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { getIntelligentArea } from "@/lib/intelligent/catalog";

type Json = Record<string, unknown>;
async function requireAccess(action: "read" | "manage") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles as string[] | undefined;
  if (roles?.includes("SUPER_ADMIN") || roles?.includes("HR_MANAGER")) return session;
  if (!hasPermission(session.user.permissions as string[] | undefined, { action, resource: "settings" }, roles)) throw new Error("Forbidden");
  return session;
}
function parse(raw: FormDataEntryValue | null, fallback: Json = {}) { const s=String(raw??"").trim(); if(!s) return fallback; try{return JSON.parse(s) as Json;}catch{return { text:s };} }
function score(input: Json) { const keys=Object.keys(input).length; return Math.min(0.95, 0.55 + keys * 0.05); }

export async function listIntelligentRecords(area:string, feature:string, search="") {
  await requireAccess("read"); const meta=getIntelligentArea(area); if(!meta||!meta.features.includes(feature as never)) throw new Error("Unknown intelligent feature"); const needle=search?{contains:search,mode:"insensitive" as const}:undefined;
  switch(area){
    case "digital-twin": return prisma.digitalTwinScenario.findMany({where:{type:feature,...(search?{OR:[{name:needle},{status:needle},{recommendation:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
    case "decision-engine": return prisma.decisionExecution.findMany({where:search?{OR:[{decision:needle},{reason:needle}]}:{},orderBy:{createdAt:"desc"},take:100});
    case "knowledge-graph": return prisma.knowledgeNode.findMany({where:{type:feature,...(search?{OR:[{label:needle},{content:needle}]}:{})},include:{outgoing:true,incoming:true},orderBy:{updatedAt:"desc"},take:100});
    case "global-search": return prisma.globalSearchDocument.findMany({where:search?{OR:[{title:needle},{content:needle},{ocrText:needle},{entity:needle}]}:{},orderBy:{rank:"desc"},take:100});
    case "real-ai-assistant": return prisma.aIAssistantConversation.findMany({where:search?{OR:[{title:needle},{status:needle}]}:{},include:{messages:true,memories:true},orderBy:{updatedAt:"desc"},take:100});
    case "low-code-platform": return prisma.lowCodeArtifact.findMany({where:{type:feature,...(search?{OR:[{code:needle},{name:needle},{status:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
    case "process-mining": return prisma.processMiningInsight.findMany({where:{type:feature,...(search?{OR:[{processKey:needle},{title:needle},{severity:needle}]}:{})},orderBy:{createdAt:"desc"},take:100});
    case "data-fabric": return prisma.dataFabricAsset.findMany({where:{assetType:feature,...(search?{OR:[{domain:needle},{name:needle},{masterKey:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
    case "predictive-analytics": return prisma.predictiveRun.findMany({where:search?{}:{},include:{model:true},orderBy:{createdAt:"desc"},take:100});
    case "generative-reports": return prisma.generativeReport.findMany({where:{type:feature,...(search?{OR:[{title:needle},{prompt:needle},{format:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
    case "observability": return prisma.observabilitySpan.findMany({where:{operation:feature,...(search?{OR:[{service:needle},{status:needle},{traceId:needle}]}:{})},orderBy:{startedAt:"desc"},take:100});
    case "edge-platform": return prisma.edgeSyncRecord.findMany({where:{operation:feature,...(search?{OR:[{deviceId:needle},{entity:needle},{status:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
    case "global-multi-region": return prisma.multiRegionConfig.findMany({where:search?{OR:[{region:needle},{role:needle},{endpoint:needle},{status:needle}]}:{},orderBy:{updatedAt:"desc"},take:100});
    case "zero-trust-security": return prisma.zeroTrustPolicy.findMany({where:{policyType:feature,...(search?{OR:[{code:needle},{name:needle}]}:{})},orderBy:{updatedAt:"desc"},take:100});
    default: return [];
  }
}

export async function saveIntelligentRecord(formData: FormData) {
  const session=await requireAccess("manage"); const area=String(formData.get("area")); const feature=String(formData.get("feature")); const meta=getIntelligentArea(area); if(!meta||!meta.features.includes(feature as never)) throw new Error("Unknown intelligent feature"); const code=String(formData.get("code")||Date.now()).trim(); const name=String(formData.get("name")||code).trim(); const input=parse(formData.get("payload"),{enabled:true}); const confidence=score(input);
  switch(area){
    case "digital-twin": { let company=await prisma.digitalTwinCompany.findFirst({where:{tenantId:null,code:"default"}}); if(!company) company=await prisma.digitalTwinCompany.create({data:{code:"default",name:"Default Twin",baseline:{},createdById:session.user.id}}); await prisma.digitalTwinScenario.create({data:{companyId:company.id,type:feature,name,input: input as any,output:{impact:input,simulatedAt:new Date().toISOString()} as any,riskScore:1-confidence,confidence,recommendation:`${name}: ${Math.round(confidence*100)}% confidence`,createdById:session.user.id}}); break; }
    case "decision-engine": { let policy=await prisma.decisionPolicy.findFirst({where:{tenantId:null,code:feature}}); if(!policy) policy=await prisma.decisionPolicy.create({data:{code:feature,name:feature,entity:area,action:feature}}); await prisma.decisionExecution.create({data:{policyId:policy.id,input: input as any,decision:confidence>0.75?"AUTO_APPROVE":"HUMAN_APPROVAL",riskScore:1-confidence,confidence,reason:`Policy ${feature} evaluated with ${Math.round(confidence*100)}% confidence`,fallbackRequired:confidence<=0.75}}); break; }
    case "knowledge-graph": { let category=await prisma.knowledgeCategory.findFirst({where:{tenantId:null,code:feature}}); if(!category) category=await prisma.knowledgeCategory.create({data:{code:feature,name:feature}}); await prisma.knowledgeNode.create({data:{categoryId:category.id,type:feature,entityId:code,label:name,content:JSON.stringify(input),metadata:input as any}}); break; }
    case "global-search": await prisma.globalSearchDocument.upsert({where:{tenantId_entity_entityId:{tenantId:"",entity:feature,entityId:code}},update:{title:name,content:JSON.stringify(input),ocrText:String((input as any).ocr||""),facets:input as any,rank:confidence},create:{tenantId:"",entity:feature,entityId:code,title:name,content:JSON.stringify(input),ocrText:String((input as any).ocr||""),facets:input as any,rank:confidence,url:`/intelligent/${area}/${feature}`}}); break;
    case "real-ai-assistant": { const conversation=await prisma.aIAssistantConversation.create({data:{title:name,userId:session.user.id,context:input as any}}); await prisma.aIAssistantMessage.create({data:{conversationId:conversation.id,role:"user",content:String((input as any).prompt||name),toolCalls:[],output:{ready:true}}}); await prisma.aIAssistantMemory.create({data:{conversationId:conversation.id,userId:session.user.id,key:code,value:input as any}}); break; }
    case "low-code-platform": await prisma.lowCodeArtifact.upsert({where:{tenantId_type_code:{tenantId:"",type:feature,code}},update:{name,schema:input as any,version:{increment:1}},create:{tenantId:"",type:feature,code,name,schema:input as any,createdById:session.user.id}}); break;
    case "process-mining": await prisma.processMiningInsight.create({data:{processKey:code,type:feature,title:name,metrics:input as any,recommendation:`Optimize ${name}`,severity:confidence>0.8?"INFO":"WARN"}}); break;
    case "data-fabric": await prisma.dataFabricAsset.create({data:{domain:feature,name,assetType:feature,metadata:input as any,lineage:input as any,quality:{score:confidence},masterKey:code,ownerId:session.user.id}}); break;
    case "predictive-analytics": { let model=await prisma.predictiveModel.findFirst({where:{tenantId:null,type:feature,code}}); if(!model) model=await prisma.predictiveModel.create({data:{type:feature,code,name,features:input as any,parameters:{algorithm:"rules"}}}); await prisma.predictiveRun.create({data:{modelId:model.id,input: input as any,output:{prediction:confidence,feature} as any,confidence}}); break; }
    case "generative-reports": await prisma.generativeReport.create({data:{type:feature,title:name,prompt:String((input as any).prompt||name),format:feature.toUpperCase(),content:{summary:name,input} as any,createdById:session.user.id}}); break;
    case "observability": await prisma.observabilitySpan.create({data:{traceId:code,spanId:`${code}-span`,service:"lana",operation:feature,status:"OK",durationMs:Number((input as any).durationMs||1),attributes:input as any,startedAt:new Date(),endedAt:new Date()}}); break;
    case "edge-platform": await prisma.edgeSyncRecord.create({data:{deviceId:code,entity:feature,entityId:code,operation:feature,payload:input as any}}); break;
    case "global-multi-region": await prisma.multiRegionConfig.upsert({where:{tenantId_region_role:{tenantId:"",region:code,role:feature}},update:{endpoint:name,geoRouting:input as any,replication:input as any,drPolicy:input as any},create:{tenantId:"",region:code,role:feature,endpoint:name,geoRouting:input as any,replication:input as any,drPolicy:input as any}}); break;
    case "zero-trust-security": await prisma.zeroTrustPolicy.upsert({where:{tenantId_code:{tenantId:"",code}},update:{name,conditions:input as any,actions:{adaptiveMfa:true}},create:{tenantId:"",code,name,policyType:feature,conditions:input as any,actions:{adaptiveMfa:true},riskThreshold:1-confidence}}); break;
  }
  await prisma.auditLog.create({data:{actorUserId:session.user.id,action:"intelligent:save",entity:`${area}/${feature}`,entityId:code,metadata:input as any}}).catch(()=>null); revalidatePath(`/intelligent/${area}/${feature}`); if(area==="digital-twin") revalidatePath("/digital-twin");
}

export async function intelligentMetrics(){ await requireAccess("read"); const counts=await Promise.all([prisma.digitalTwinScenario.count().catch(()=>0),prisma.decisionExecution.count().catch(()=>0),prisma.knowledgeNode.count().catch(()=>0),prisma.globalSearchDocument.count().catch(()=>0),prisma.aIAssistantConversation.count().catch(()=>0),prisma.lowCodeArtifact.count().catch(()=>0),prisma.processMiningInsight.count().catch(()=>0),prisma.dataFabricAsset.count().catch(()=>0),prisma.predictiveRun.count().catch(()=>0),prisma.generativeReport.count().catch(()=>0),prisma.observabilitySpan.count().catch(()=>0),prisma.edgeSyncRecord.count().catch(()=>0),prisma.multiRegionConfig.count().catch(()=>0),prisma.zeroTrustPolicy.count().catch(()=>0)]); return counts.reduce((a,b)=>a+b,0); }
