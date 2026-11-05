import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { load } from '../workflows/helpers.mjs';
const url = new URL(process.env.PAYROLL_TEST_DATABASE_URL ?? '');
if (!['localhost','127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Disposable local *_test database required');
const prisma = new PrismaClient({ datasourceUrl: url.href });
const calculations = await load('lib/payroll/calculations.ts');
const settlement = await load('lib/payroll/settlement.ts', { './calculations': calculations });
const id = randomUUID(); let employee, run, user;
try {
 user = await prisma.user.create({ data: { username: `payroll-${id}` } });
 employee = await prisma.employee.create({ data: { employeeNumber: `PAY-${id}`, nationalId: `PAY-${id}`, firstName:'Payroll', lastName:'Test', hireDate:new Date(), userId:user.id } });
 const loan = await prisma.loan.create({ data: { employeeId:employee.id, loanNumber:`LN-${id}`, principalAmount:400, outstandingAmount:400, installmentAmount:100, currency:'SAR', issuedAt:new Date(), status:'ACTIVE' } });
 const advance = await prisma.employeeSalaryAdvance.create({ data: { employeeId:employee.id, amount:100, monthlyDeduction:25, installments:4, reason:'Test', startDate:new Date(), status:'APPROVED' } });
 run = await prisma.payrollRun.create({ data: { name:'Frozen payroll integration', period:`TEST-${id}`, status:'PROCESSING' } });
 let broken = false;
 const engine = await load('lib/enterprise/payroll-engine.ts', {
   '@/lib/prisma': { prisma }, '@/lib/payroll/calculations': calculations,
   '@/lib/employee/salary-profile-store': { getEmployeeSalaryProfile: async () => { if (broken) throw new Error('Missing salary source'); return { salaryBase: 1000 }; } },
   '@/lib/employee/salary-profile': { calculateNetSalary: () => 1000 },
 });
 await engine.computeAndUpsertPayrollItems(run.id, new Date('2026-11-01'), new Date('2026-11-30'), { employeeIds: [employee.id] });
 const item = await prisma.payrollItem.findUniqueOrThrow({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } } });
 assert.equal(Number(item.netPay), 875);

 class NextResponse { static json(data, options={}) { return { data, status:options.status??200 }; } }
 const route = await load('app/api/enterprise/payroll/run/[id]/route.ts', {
   'next/server':{NextResponse}, '@/auth':{auth:async()=>({user:{id:user.id,roles:['SUPER_ADMIN']}})}, '@/lib/prisma':{prisma},
   '@/lib/audit':{writeAuditLog:async()=>{}}, '@/lib/enterprise/payroll-engine':{computeAndUpsertPayrollItems:async()=>{throw new Error('Must not recompute approved figures');}},
   '@/lib/enterprise/notifications':{notifyRole:async()=>{}}, '@/lib/enterprise/payroll-permissions':{canManagePayroll:()=>true,canApprovePayroll:()=>true},
   '@/lib/payroll/settlement':settlement, '@/lib/payroll/journal':{accountingMappingSchema:{safeParse:()=>({success:false})},postConfiguredPayrollJournal:async()=>{throw new Error('No remote posting');}}, '@/lib/payroll/connection':{getPayrollOdooClient:async()=>{throw new Error('No remote operations in tests');}},
   '@/lib/payroll/odoo-payroll':{odooPayrollSource:()=>'',reconcileAccountingOutbox:async()=>{throw new Error('No remote operations in tests');}},
 });
 const patch = action => route.PATCH({json:async()=>({action})},{params:Promise.resolve({id:run.id})});
 broken = true;
 const failed = await engine.computeAndUpsertPayrollItems(run.id, new Date('2026-11-01'), new Date('2026-11-30'), { employeeIds: [employee.id] });
 assert.equal(failed.errorCount, 1); assert.equal((await patch('approve')).status,409);
 assert.equal(Number((await prisma.payrollItem.findUniqueOrThrow({where:{id:item.id}})).netPay),875);
 broken = false;
 await engine.computeAndUpsertPayrollItems(run.id, new Date('2026-11-01'), new Date('2026-11-30'), { employeeIds: [employee.id] });
 assert.equal((await patch('approve')).status,200);
 await prisma.loan.update({where:{id:loan.id},data:{outstandingAmount:350}});
 assert.equal((await patch('pay')).status,409);
 assert.equal((await prisma.payrollRun.findUniqueOrThrow({where:{id:run.id}})).status,'APPROVED');
 assert.equal((await prisma.employeeSalaryAdvance.findUniqueOrThrow({where:{id:advance.id}})).paidInstallments,0);
 await prisma.loan.update({where:{id:loan.id},data:{outstandingAmount:400}});
 const responses = await Promise.all([patch('pay'),patch('pay')]);
 assert.equal(responses.filter(response=>response.status===200).length,1);
 assert.equal(Number((await prisma.loan.findUniqueOrThrow({where:{id:loan.id}})).outstandingAmount),300);
 assert.equal((await prisma.employeeSalaryAdvance.findUniqueOrThrow({where:{id:advance.id}})).paidInstallments,1);
 assert.equal(Number((await prisma.payrollItem.findUniqueOrThrow({where:{id:item.id}})).netPay),875);
 assert.equal((await patch('pay')).status,409);
 console.log('PASS: frozen approved values, source conflict rolls back all effects, concurrent pay consumes loan/advance exactly once');
} finally {
 if(run){await prisma.appSetting.deleteMany({where:{key:`payroll.compute.${run.id}`}});await prisma.auditLog.deleteMany({where:{entity:'payrollRun',entityId:run.id}});await prisma.payrollRun.delete({where:{id:run.id}});}
 if(employee) await prisma.employee.delete({where:{id:employee.id}});
 if(user) await prisma.user.delete({where:{id:user.id}});
 await prisma.$disconnect();
}
