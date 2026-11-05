import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient,Prisma } from '@prisma/client';
import { load } from '../workflows/helpers.mjs';
const url=new URL(process.env.PAYROLL_TEST_DATABASE_URL??'');if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw new Error('Isolated local test database required');
const prisma=new PrismaClient({datasourceUrl:url.href});const key=randomUUID();const employees=[],runs=[];let historyRun;
const reporting=await load('lib/payroll/register.ts',{'@prisma/client':{Prisma},'@/lib/prisma':{prisma}});
try{
 for(let i=0;i<2;i++)employees.push(await prisma.employee.create({data:{employeeNumber:`RG-${key}-${i}`,nationalId:`RG-${key}-${i}`,firstName:i?'Private':'Visible',lastName:'Payroll',hireDate:new Date()}}));
 historyRun=await prisma.historicalPayrollRun.create({data:{source:key,period:'2026-01',companyOdooId:1}});
 const data={runId:historyRun.id,source:key,employeeId:employees[0].id,state:'paid',currency:'SAR',fromDate:new Date('2026-01-01'),toDate:new Date('2026-01-31'),basic:1000,gross:1200,deductions:100,net:1100,raw:{},checksum:key};
 await prisma.historicalPayslip.create({data:{...data,odooPayslipId:101}});await prisma.historicalPayslip.create({data:{...data,odooPayslipId:102,currency:'USD'}});await prisma.historicalPayslip.create({data:{...data,employeeId:employees[1].id,odooPayslipId:103}});
 for(let i=0;i<2;i++)runs.push(await prisma.payrollRun.create({data:{name:'Register test',period:`RG-${key}-${i}`}}));
 await prisma.payrollItem.create({data:{payrollRunId:runs[0].id,employeeId:employees[0].id,odooPayslipId:101,baseSalary:1000,grossPay:1200,deductionTotal:100,netPay:1100,currency:'SAR',calculationSnapshot:{source:key}}});
 await prisma.payrollItem.create({data:{payrollRunId:runs[1].id,employeeId:employees[0].id,baseSalary:500,grossPay:500,deductionTotal:0,netPay:500,currency:'SAR'}});
 const filter={employeeIds:[employees[0].id],source:'ALL',period:'',search:'',status:'',currency:'',runId:'',page:1,pageSize:20};
 const result=await reporting.payrollRegister(filter,'payslips');assert.equal(result.total,3);assert.equal(result.totals.length,2);assert.equal(result.rows.some(r=>r.employeeName.startsWith('Private')),false);assert.equal(result.totals.find(r=>r.currency==='SAR').net,'1600');
 assert.equal((await reporting.payrollRegister({...filter,period:'2026-01'},'payslips')).total,2);assert.equal((await reporting.payrollRegister({...filter,source:'ODOO'},'runs')).total,2);assert.equal((await reporting.payrollRegister({...filter,employeeIds:[]},'payslips')).total,0);
 assert.equal((await reporting.payrollRegister({...filter,search:"' OR 1=1 --"},'payslips')).total,0);
 const page=await reporting.payrollRegister({...filter,pageSize:1,page:2},'payslips');assert.equal(page.rows.length,1);assert.equal(page.total,3);
 assert.equal((await reporting.payrollRegister({...filter,source:'LOCAL',runId:runs[0].id},'payslips')).total,1);
 await prisma.historicalPayslip.create({data:{...data,odooPayslipId:104,basic:200,gross:220,deductions:20,net:200,raw:{credit_note:true}}});await prisma.historicalPayslip.create({data:{...data,odooPayslipId:105,state:'cancel',net:999}});
 const revised=await reporting.payrollRegister(filter,'payslips');assert.equal(revised.totals.find(row=>row.currency==='SAR').net,'1400');const grouped=await reporting.payrollRegister({...filter,source:'ODOO'},'runs');assert.equal(grouped.rows.find(row=>row.currency==='SAR').net,'900');
 console.log('PASS: scoped unified register, source-copy deduplication, currency-separated totals, two historical slips in one month, SQL-safe filters and database pagination');
}finally{for(const run of runs)await prisma.payrollRun.delete({where:{id:run.id}});if(historyRun){await prisma.historicalPayslip.deleteMany({where:{runId:historyRun.id}});await prisma.historicalPayrollRun.delete({where:{id:historyRun.id}});}await prisma.employee.deleteMany({where:{id:{in:employees.map(e=>e.id)}}});await prisma.$disconnect();}
