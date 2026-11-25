import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {loadHrTaskPolicy,validateHrTaskRecipients} from "@/lib/enterprise/hr-task-events";
import {hrTaskPolicyKey,hrTaskPolicySchema} from "@/lib/enterprise/hr-task-policy";
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export const dynamic="force-dynamic";
async function actor(){const session=await auth();return session?.user?.id&&session.user.roles?.includes("SUPER_ADMIN")?session.user.id:null;}
export async function GET(){if(!await actor())return json({success:false},403);
 const [policy,users]=await Promise.all([loadHrTaskPolicy(),prisma.user.findMany({where:{isActive:true,roles:{some:{role:{name:{in:["SUPER_ADMIN","HR_MANAGER"]}}}}},select:{id:true,name:true}})]);
 const employees=await prisma.employee.findMany({where:{userId:{in:users.map(u=>u.id)},status:"ACTIVE",archivedAt:null,OR:[{terminationDate:null},{terminationDate:{gt:new Date()}}]},select:{id:true,userId:true,employeeNumber:true,firstName:true,lastName:true}});
 return json({success:true,policy,users,employees});
}
export async function POST(request:Request){const id=await actor();if(!id)return json({success:false},403);
 const parsed=hrTaskPolicySchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({success:false,message:"راجع إعدادات قواعد التكليف"},400);
 const policy=parsed.data;
 try{if(policy.enabled)await validateHrTaskRecipients(policy);
 await prisma.$transaction(async tx=>{const old=await tx.appSetting.findUnique({where:{key:hrTaskPolicyKey}});await tx.appSetting.upsert({where:{key:hrTaskPolicyKey},create:{key:hrTaskPolicyKey,value:policy},update:{value:policy}});await tx.auditLog.create({data:{actorUserId:id,action:"work-task:hr-policy",entity:"appSetting",entityId:hrTaskPolicyKey,metadata:{previous:old?.value??null,next:policy}}});},{isolationLevel:"Serializable"});
 return json({success:true,policy});
 }catch(e){return json({success:false,message:e instanceof Error&&!("code" in e)?e.message:"تعذر حفظ القواعد"},409);}
}
