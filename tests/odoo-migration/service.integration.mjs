import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { load } from '../workflows/helpers.mjs';
const database=new URL(process.env.ODOO_MIGRATION_TEST_DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(database.hostname)||!database.pathname.endsWith('_test'))throw new Error('Disposable local *_test database required');
const prisma=new PrismaClient({datasourceUrl:database.href});
const mapping=await load('lib/integrations/odoo/migration/mapping.ts',{zod:await import('zod')});
const key=randomUUID();const base=10000000+Math.floor(Math.random()*10000000);const source=crypto.createHash('sha256').update(key).digest('hex');
const loanId=base+2000,slipId=base+3000;
const employees=Array.from({length:501},(_,i)=>({id:base+i+1,name:`Migration Employee ${i+1}`,barcode:`MX-${key}-${i+1}`,identification_id:`ID-${key}-${i+1}`,active:i!==1,first_contract_date:i===4?false:'2020-01-01',work_email:false,marital:'married',write_date:'2026-11-01 00:00:00',parent_id:i===0?[base+2,'Manager']:false,department_id:i<2?[base+1000,'Test department']:false,job_id:i<2?[base+1001,'Test job']:false,country_id:i<2?[base+1002,'Saudi Arabia']:false,company_id:[base+1003,'Migration test company'],departure_date:i===1?'2026-10-01':false,departure_reason_id:i===1?[1,'Resigned']:false}));
employees[3].identification_id=employees[2].identification_id;
const paidRows=Array.from({length:10},(_,i)=>({id:base+2100+i,loan_id:[loanId,'Loan'],date:`${i<7?'2026':'2027'}-${String(i<7?i+6:i-6).padStart(2,'0')}-01`,amount:100,paid:i<5}));
const loans=[{id:loanId,employee_id:[base+1,'Employee'],loan_amount:1000,balance_amount:500,state:'approve',currency_id:[1,'SAR'],date:'2026-06-01',loan_lines:paidRows.map(row=>row.id),write_date:'2026-11-01 00:00:00'}, {id:loanId+1,employee_id:[base+2,'Employee'],loan_amount:1000,balance_amount:123,state:'approve',currency_id:[1,'SAR'],date:'2026-06-01',loan_lines:paidRows.map(row=>row.id+100),write_date:'2026-11-01 00:00:00'}];
loans.push({id:loanId+2,employee_id:[base+1,'Employee'],loan_amount:200,balance_amount:200,state:'draft',currency_id:[1,'SAR'],date:'2026-11-01',loan_lines:[],write_date:'2026-11-01 00:00:00'});
const loanLines=[...paidRows,...paidRows.map(row=>({...row,id:row.id+100,loan_id:[loanId+1,'Loan']}))];
const house=`HOUSE-${key}`,ded=`DED-${key}`,info=`INFO-${key}`;
const lines=[{code:'BASIC',total:'1000.000001'},{code:house,total:'200.000001'},{code:ded,total:'-100.000001'},{code:'GROSS',total:'1200.000002'},{code:'NET',total:'1100.000001'},...Array.from({length:998},()=>({code:info,total:0}))].map((line,i)=>({id:base+5000+i,slip_id:[slipId,'Slip'],name:line.code,amount:line.total,quantity:1,rate:100,...line}));
const second=[{code:'BASIC',total:2000},{code:'GROSS',total:2000},{code:'NET',total:2000}].map((line,i)=>({id:base+7000+i,slip_id:[slipId+1,'Slip'],name:line.code,amount:line.total,quantity:1,rate:100,...line}));
const slips=[{id:slipId,employee_id:[base+1,'Employee'],company_id:[base+1003,'Company'],date_from:'2026-01-01',date_to:'2026-01-31',state:'paid',currency_id:[1,'SAR'],payslip_run_id:[1,'January'],line_ids:lines.map(row=>row.id),write_date:'2026-02-01 00:00:00'}, {id:slipId+1,employee_id:[base+1,'Employee'],company_id:[base+1003,'Company'],date_from:'2026-01-01',date_to:'2026-01-31',state:'done',currency_id:[1,'SAR'],payslip_run_id:[1,'January'],line_ids:second.map(row=>row.id),write_date:'2026-02-01 00:00:00'}];
const tables={'hr.employee':employees,'hr.loan':loans,'hr.loan.line':loanLines,'hr.payslip':slips,'hr.payslip.line':[...lines,...second],'res.country':[{id:base+1002,name:'Saudi Arabia',code:'SA'}],'res.currency':[{id:1,name:'SAR'}],'res.company':[{id:base+1003,currency_id:[1,'SAR']}]};
function filter(rows,domain){return rows.filter(row=>domain.every(([field,op,value])=>{const actual=Array.isArray(row[field])?row[field][0]:row[field];return op==='='?actual===value:op==='>'?actual>value:op==='<='?actual<=value:op==='>='?actual>=value:op==='<'?actual<value:op==='in'?value.includes(actual):false;}));}
const client={getConfig:()=>({url:'https://odoo-test.invalid',database:key}),fieldsGet:async model=>{if(!tables[model])throw new Error('Unknown model');return Object.fromEntries(Object.keys(tables[model][0]).map(field=>[field,{relation:field==='loan_lines'?'hr.loan.line':undefined}]));},search_read:async(model,domain,fields,options={})=>{
 assert.equal(options.context?.active_test??false,false);let rows=filter(tables[model]??[],domain);
 const order=(options.order??'id asc').split(',').map(item=>item.trim().split(' '));rows=[...rows].sort((a,b)=>{for(const [field,direction] of order){if(a[field]!==b[field])return(a[field]<b[field]?-1:1)*(direction==='desc'?-1:1);}return 0;});
 return rows.slice(0,options.limit??rows.length).map(row=>Object.fromEntries(['id',...fields].map(field=>[field,row[field]])));
},read:async(model,ids,fields)=>tables[model].filter(row=>ids.includes(row.id)).map(row=>Object.fromEntries(['id',...fields].map(field=>[field,row[field]]))),execute_kw:async(model,method,args)=>{if(method!=='search_count')throw new Error('Remote write prohibited in migration tests');return filter(tables[model],args[0]).length;}};
const reader=await load('lib/integrations/odoo/migration/reader.ts',{'./mapping':mapping});
const importers=await load('lib/integrations/odoo/migration/importers.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma},'./mapping':mapping,'./reader':reader});
const worker=await load('lib/integrations/odoo/migration/worker.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma},'@/lib/payroll/connection':{getPayrollOdooClient:async()=>({client})},'@/lib/payroll/odoo-payroll':{odooPayrollSource:()=>source},'./mapping':mapping,'./importers':importers,'./reader':reader,'@/lib/payroll/contract-sync':{contractBatch:async()=>{throw new Error('FULL mode does not enter contract phase');}},'@/lib/integrations/odoo/contract-salary':{discoverContractFields:()=>[]},'@/lib/payroll/source-rules':{discoverSalaryRules:async()=>({created:0})}});
let job;const createdRules=[];const previousBinding=await prisma.appSetting.findUnique({where:{key:'odoo.migration.employeeSource'}});if(previousBinding)throw new Error('Test database has an existing source binding; use a fresh disposable database');
const existingNationality=await prisma.nationality.findUnique({where:{code:'SA'}});
let actor;
try{
 actor=await prisma.user.create({data:{username:`migration-${key}`}});
 for(const [code,category] of [[house,'ALLOWANCE'],[ded,'DEDUCTION'],[info,'INFORMATION']])createdRules.push(await prisma.salaryRule.create({data:{code,name:'Migration test rule',category}}));
 job=await worker.createMigration(mapping.migrationConfigSchema.parse({fromMonth:'2026-01',toMonth:'2026-02',departureReasons:{'1':'RESIGNED'}}),actor.id);
 const parallel=await Promise.allSettled([worker.processMigrationStep(job.id),worker.processMigrationStep(job.id)]);assert.equal(parallel.filter(result=>result.status==='fulfilled').length,1);
 let status=await worker.migrationStatus(job.id);assert.equal(status.cursor,base+500);assert.equal(status.processed,500);
 await worker.controlMigration(job.id,'pause',actor.id);await assert.rejects(worker.processMigrationStep(job.id));await worker.controlMigration(job.id,'resume',actor.id);
 for(let i=0;i<20;i++){status=await worker.migrationStatus(job.id);if(status.status.startsWith('COMPLETED'))break;await worker.processMigrationStep(job.id);}
 status=await worker.migrationStatus(job.id);assert.equal(status.status,'COMPLETED_WITH_ERRORS');assert.equal(status.progress,100);
 assert.equal(await prisma.employee.count({where:{employeeNumber:{startsWith:`MX-${key}`}}}),498);
 const owner=await prisma.employee.findUniqueOrThrow({where:{odooId:base+1}});const manager=await prisma.employee.findUniqueOrThrow({where:{odooId:base+2}});assert.equal(owner.managerId,manager.id);assert.equal(manager.workingStatus,'RESIGNED');assert.equal(manager.status,'TERMINATED');
 assert.equal(await prisma.historicalPayslip.count({where:{source}}),2);const historic=await prisma.historicalPayslip.findUniqueOrThrow({where:{source_odooPayslipId:{source,odooPayslipId:slipId}},include:{lines:true}});assert.equal(historic.lines.length,1003);assert.equal(String(historic.net),'1100.000001');assert.equal(await prisma.payrollItem.count({where:{employeeId:owner.id}}),0);
 const missing=status.errors.find(error=>error.entity==='EMPLOYEES'&&error.externalId===base+5);assert.ok(missing);employees[4].first_contract_date='2020-01-01';await worker.retryMigrationRecord(job.id,missing.id);assert.ok(await prisma.employee.findUnique({where:{odooId:base+5}}));
 assert.equal((await prisma.loan.findUniqueOrThrow({where:{odooSource_odooLoanModel_odooLoanId:{odooSource:source,odooLoanModel:'hr.loan',odooLoanId:loanId+2}}})).status,'PENDING');
 const loan=await prisma.loan.findUniqueOrThrow({where:{odooSource_odooLoanModel_odooLoanId:{odooSource:source,odooLoanModel:'hr.loan',odooLoanId:loanId}}});assert.equal(Number(loan.outstandingAmount),500);assert.equal(await prisma.odooLoanInstallment.count({where:{loanId:loan.id}}),10);
 const context={source,actorUserId:actor.id,config:mapping.migrationConfigSchema.parse({}),client};
 const calculations=await load('lib/payroll/calculations.ts');
 const engine=await load('lib/enterprise/payroll-engine.ts',{'@/lib/prisma':{prisma},'@/lib/payroll/calculations':calculations,'@/lib/employee/salary-profile-store':{getEmployeeSalaryProfile:async()=>({salaryBase:1000})},'@/lib/employee/salary-profile':{calculateNetSalary:()=>1000}});
 const snapshot=await engine.computeEmployeePayroll(owner.id,new Date('2026-11-01'),new Date('2026-11-30'));assert.equal(snapshot.loanDeduction,100);assert.equal(snapshot.loanAllocations[0].installmentIds.length,1);
 const settlement=await load('lib/payroll/settlement.ts',{'./calculations':calculations});await prisma.$transaction(tx=>settlement.consumeApprovedPayroll(tx,snapshot,owner.id,new Date()));
 assert.equal(Number((await prisma.loan.findUniqueOrThrow({where:{id:loan.id}})).outstandingAmount),400);
 loans[0].write_date='2026-11-02 00:00:00';await(await importers.loanBatch(context,[loans[0]]))(loans[0]);assert.equal(Number((await prisma.loan.findUniqueOrThrow({where:{id:loan.id}})).outstandingAmount),400);
 assert.equal((await engine.computeEmployeePayroll(owner.id,new Date('2026-11-01'),new Date('2026-11-30'))).loanDeduction,0);
 paidRows[5].paid=true;loans[0].balance_amount=400;loans[0].write_date='2026-11-03 00:00:00';await(await importers.loanBatch(context,[loans[0]]))(loans[0]);assert.equal(Number((await prisma.loan.findUniqueOrThrow({where:{id:loan.id}})).outstandingAmount),400);
 const original=lines[0].total;lines[0].total='1001.000001';lines[3].total='1201.000002';lines[4].total='1101.000001';slips[0].write_date='2026-11-04 00:00:00';await assert.rejects((await importers.payrollBatch(context,[slips[0]]))(slips[0]),/تغير كشف تاريخي/);assert.equal(String((await prisma.historicalPayslip.findUniqueOrThrow({where:{id:historic.id}})).basic),original);
 console.log('PASS: 501 employees over 500-row checkpoints; duplicate skip; resignation; manager mapping; durable retry; 1003 exact historical lines; multiple slips per employee/month; scheduled loan consumption and upstream reconciliation without double deduction; finalized history protected');
}finally{
 const jobIds=(await prisma.odooMigrationJob.findMany({where:{source},select:{id:true}})).map(row=>row.id);await prisma.auditLog.deleteMany({where:{entity:'odooMigrationJob',entityId:{in:jobIds}}});await prisma.odooMigrationJob.deleteMany({where:{source}});
 await prisma.historicalPayslip.deleteMany({where:{source}});await prisma.historicalPayrollRun.deleteMany({where:{source}});await prisma.loan.deleteMany({where:{odooSource:source}});await prisma.odooSourceRecord.deleteMany({where:{source}});
 await prisma.employee.deleteMany({where:{employeeNumber:{startsWith:`MX-${key}`}}});await prisma.position.deleteMany({where:{odooId:base+1001}});await prisma.department.deleteMany({where:{odooId:base+1000}});await prisma.company.deleteMany({where:{code:`ODOO-${source.slice(0,8)}-${base+1003}`}});
 if(!existingNationality)await prisma.nationality.deleteMany({where:{code:'SA',employees:{none:{}}}});
 await prisma.salaryRule.deleteMany({where:{id:{in:createdRules.map(row=>row.id)}}});await prisma.appSetting.deleteMany({where:{key:'odoo.migration.employeeSource',value:{equals:source}}});if(actor)await prisma.user.delete({where:{id:actor.id}});await prisma.$disconnect();
}
