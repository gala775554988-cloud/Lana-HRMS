import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {canApprovePayroll} from "@/lib/enterprise/payroll-permissions";
import {loadAutomationPolicy} from "@/lib/enterprise/automation-alerts";
import {automationSettingKey,automationPolicySchema} from "@/lib/enterprise/automation-rules";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export const dynamic="force-dynamic";
export async function GET(){const session=await auth();if(!session?.user?.id)return reply({success:false},401);if(!canApprovePayroll(session))return reply({success:false},403);return reply({success:true,policy:await loadAutomationPolicy()});}
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return reply({success:false},401);if(!canApprovePayroll(session))return reply({success:false},403);
 const parsed=automationPolicySchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return reply({success:false,message:"إعدادات غير صالحة"},400);
 await prisma.$transaction(async tx=>{
  const old=await tx.appSetting.findUnique({where:{key:automationSettingKey}});
  await tx.appSetting.upsert({where:{key:automationSettingKey},create:{key:automationSettingKey,value:parsed.data},update:{value:parsed.data}});
  await tx.auditLog.create({data:{actorUserId:session.user.id,action:"automation:policy-update",entity:"appSetting",entityId:automationSettingKey,metadata:{previous:old?.value??null,next:parsed.data}}});
 },{isolationLevel:"Serializable"});
 return reply({success:true,policy:parsed.data});
}
