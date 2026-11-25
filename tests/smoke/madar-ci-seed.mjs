import {PrismaClient} from "@prisma/client";
import bcrypt from "bcryptjs";
const url=new URL(process.env.DATABASE_URL??"");
if(!["localhost","127.0.0.1"].includes(url.hostname)||!url.pathname.endsWith("_test")||process.env.CI!=="true")throw Error("Disposable CI database required");
const prisma=new PrismaClient({datasourceUrl:url.href});
try{
 const password=process.env.MADAR_SMOKE_PASSWORD;if(!password)throw Error("Missing disposable test password");
 const passwordHash=await bcrypt.hash(password,10);
 const users={};
 for(const [username,role] of [["madar-ci-admin","SUPER_ADMIN"],["madar-ci-worker","EMPLOYEE"],["madar-ci-other","EMPLOYEE"]]){
  const r=await prisma.role.upsert({where:{name:role},update:{},create:{name:role,description:"Disposable browser fixture",isSystem:true}});
  const u=await prisma.user.create({data:{username,name:username,passwordHash,isActive:true,employeePasswordMode:"CUSTOM",mustChangePassword:false,passwordChanged:true,roles:{create:{roleId:r.id}}}});
  users[username]=u;
  if(role==="EMPLOYEE")await prisma.employee.create({data:{employeeNumber:username,nationalId:username,firstName:"CI",lastName:username,hireDate:new Date("2024-01-01"),status:"ACTIVE",userId:u.id}});
 }
 const employee=await prisma.employee.findFirstOrThrow({where:{userId:users["madar-ci-worker"].id}});
 const now=Date.now();
 await prisma.madarWorkTask.create({data:{employeeId:employee.id,createdById:users["madar-ci-admin"].id,reviewerId:users["madar-ci-admin"].id,groupKey:"CI-RECURRENCE",title:"CI recurrence sentinel",description:"Disposable fixture",dueAt:new Date(now-2*86400000),repeatEvery:"DAILY",repeatUntil:new Date(now+3*86400000),nextDueAt:new Date(now+60*60000)}});
 console.log("Prepared three isolated test accounts and recurrence fixture");
}finally{await prisma.$disconnect();}
