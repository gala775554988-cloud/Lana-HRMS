import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { plan, migrationChecksums } from "./plan";
export const runtime="nodejs";
export const maxDuration=300;
const digest=(value:string)=>createHash("sha256").update(value).digest();
type Db=Prisma.TransactionClient;
async function catalog(db:Db){
 const [tables,columns,indexes,constraints]=await Promise.all([
  db.$queryRaw<{name:string}[]>`SELECT tablename AS name FROM pg_tables WHERE schemaname='public'`,
  db.$queryRaw<{table:string;name:string;type:string}[]>`SELECT table_name AS "table",column_name AS name,data_type AS type FROM information_schema.columns WHERE table_schema='public'`,
  db.$queryRaw<{name:string}[]>`SELECT indexname AS name FROM pg_indexes WHERE schemaname='public'`,
  db.$queryRaw<{name:string}[]>`SELECT conname AS name FROM pg_constraint WHERE connamespace='public'::regnamespace`,
 ]);
 return {tables:new Set(tables.map(row=>row.name)),columns:new Set(columns.map(row=>`${row.table}.${row.name}`)),indexes:new Set(indexes.map(row=>row.name)),constraints:new Set(constraints.map(row=>row.name))};
}
export async function POST(request:Request){
 const configured=process.env.LANA_SCHEMA_UPGRADE_SECRET;
 if(!configured||!timingSafeEqual(digest(request.headers.get("x-lana-schema-key")??""),digest(configured)))return NextResponse.json({success:false},{status:401});
 if(process.env.VERCEL_ENV!=="production"&&process.env.LANA_SCHEMA_TEST!=="true")return NextResponse.json({success:false},{status:403});
 const body=await request.json().catch(()=>null);if(!["inspect","apply"].includes(body?.action))return NextResponse.json({success:false},{status:400});
 const db=new PrismaClient({datasourceUrl:process.env.DATABASE_URL,log:[]});
 try{
  const before=await catalog(db);
  const foundations=["Employee","Loan","PayrollItem","SocialInsuranceRecord","WorkflowInstance","AuditLog"];
  if(foundations.some(table=>!before.tables.has(table)))return NextResponse.json({success:false,error:"FOUNDATION_MISSING"},{status:409});
  const exists=(item:typeof plan[number],state:Awaited<ReturnType<typeof catalog>>)=>item.kind==="table"?state.tables.has(item.name):item.kind==="column"?state.columns.has(`${item.table}.${item.name}`):item.kind==="index"?state.indexes.has(item.name):state.constraints.has(item.name);
  const pending=plan.filter(item=>!exists(item,before));
  if(body.action==="inspect")return NextResponse.json({success:true,pending:pending.map(({kind,table,name,migration})=>({kind,table,name,migration})),trackingTablePresent:before.tables.has("_prisma_migrations")},{headers:{"Cache-Control":"no-store"}});
  const applied=await db.$transaction(async tx=>{
   await tx.$executeRaw`SET LOCAL lock_timeout = '8s'`;
   await tx.$executeRaw`SET LOCAL statement_timeout = '45s'`;
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261105, 3)`;
   let count=0;
   for(const item of plan){const state=await catalog(tx);if(exists(item,state))continue;await tx.$executeRawUnsafe(item.sql);count++;}
   const required:{[table:string]:string[]}={Loan:["odooSource","odooLoanModel","odooLoanId","odooWriteDate"],PayrollItem:["calculationSnapshot","employerInsurance"],SocialInsuranceRecord:["coverageCohort","firstCoverageDate"],gosi_settings:["cohort","effectiveFrom","employeeRate","employerRate"],salary_rules:["code","category"],OdooPayrollSnapshot:["source","odooPayslipId","raw","lines"],PayrollAccountingOutbox:["payrollRunId","payload","status"],OdooMigrationJob:["config","phase","cursor","leaseToken"],OdooMigrationError:["jobId","externalId","status"],OdooSourceRecord:["source","entity","raw"],OdooLoanInstallment:["loanId","remotePaid","localPaidAt"],HistoricalPayrollRun:["source","period"],HistoricalPayslip:["runId","employeeId","basic","net"],HistoricalPayslipLine:["payslipId","amount","quantity","rate","total"]};
   for(const [table,columns] of Object.entries(required))await tx.$queryRawUnsafe(`SELECT ${columns.map(column=>`"${column}"`).join(",")} FROM "${table}" LIMIT 0`);
   for(const migration of [...new Set(plan.map(item=>item.migration))]){
    if(before.tables.has("_prisma_migrations")){
      const rows=await tx.$queryRaw<{checksum:string;finished_at:Date|null;rolled_back_at:Date|null}[]>`SELECT checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=${migration}`;
      if(rows.length&&(!rows.some(row=>row.checksum===migrationChecksums[migration]&&row.finished_at&&!row.rolled_back_at)))throw new Error("MIGRATION_TRACKING_CONFLICT");
      if(!rows.length)await tx.$executeRaw`INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES (${randomUUID()},${migrationChecksums[migration]},NOW(),${migration},NOW(),1)`;
    }
    await tx.$executeRaw`INSERT INTO "AuditLog" (id,action,entity,"entityId",metadata,"createdAt") VALUES (${randomUUID()},'schema:upgrade','migration',${migration},${JSON.stringify({deployment:process.env.VERCEL_GIT_COMMIT_SHA??null,appliedStatements:count})}::jsonb,NOW())`;
   }
   return count;
  },{timeout:90000,maxWait:10000});
  const after=await catalog(db);const missing=plan.filter(item=>!exists(item,after));
  return NextResponse.json({success:missing.length===0,appliedStatements:applied,remainingObjects:missing.length},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({success:false,error:"SCHEMA_OPERATION_FAILED",code:error instanceof Prisma.PrismaClientKnownRequestError?error.code:"UNKNOWN"},{status:409});}
 finally{await db.$disconnect();}
}
