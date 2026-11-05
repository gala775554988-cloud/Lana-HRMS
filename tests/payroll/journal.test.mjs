import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../workflows/helpers.mjs';
const calculations = await load('lib/payroll/calculations.ts');
const mapping = {mode:'POST_JOURNAL',companyId:1,journalId:2,currencyId:3,expenseAccountId:10,deductionAccountId:11,salaryPayableAccountId:12,employerExpenseAccountId:13,employerPayableAccountId:14};
const components = [{code:'BASIC',name:'Basic',kind:'EARNING',amount:1000},{code:'GOSI',name:'Gosi',kind:'DEDUCTION',amount:100}];
function setup() {
 let status='PENDING', creates=0, posts=0, remote=null, loseResponse=true;
 const entry={id:'o',payrollRunId:'r',payload:{}};
 const prisma={payrollAccountingOutbox:{findUniqueOrThrow:async()=>({...entry,status}),updateMany:async({where,data})=>{if(!where.status.in.includes(status))return{count:0};status=data.status;return{count:1};},update:async({data})=>{status=data.status;return{};}},payrollRun:{findUniqueOrThrow:async()=>({id:'r',status:'APPROVED',periodEndDate:new Date('2026-11-30'),items:[{employeeId:'e',netPay:900,employerInsurance:100,odooPayslipId:null,currency:'SAR',calculationSnapshot:{components}}]})}};
 const client={forFinancialWrites(){return this;},search_read:async(model)=>{
  if(model==='res.currency')return[{name:'SAR'}];if(model==='account.journal')return[{id:2}];
  if(model==='account.move')return remote?[{id:5,state:remote.state,journal_id:[2,'Journal'],date:'2026-11-30'}]:[];
  if(model==='account.move.line')return remote.lines.map((line,index)=>({...line,id:index+1,account_id:[line.account_id,'Account']}));
  throw new Error('Unexpected model');
 },create:async(_model,data)=>{creates++;remote={state:'draft',lines:data.line_ids.map(row=>row[2])};if(loseResponse){loseResponse=false;throw new Error('Response lost after commit');}return 5;},execute_kw:async()=>{posts++;remote.state='posted';return true;}};
 return {prisma,client,status:()=>status,creates:()=>creates,posts:()=>posts};
}
async function moduleFor(prisma) {return load('lib/payroll/journal.ts',{'./calculations':calculations,'@/lib/prisma':{prisma},zod:await import('zod')});}
test('journal keeps every component and employer insurance balanced with salary payable',async()=>{
 const api=await moduleFor({});const result=api.buildPayrollJournal([{reference:'e',netPay:900,employerInsurance:100,components}],mapping);
 assert.equal(result.debit,1100);assert.equal(result.credit,1100);assert.equal(result.lines.length,5);
 assert.throws(()=>api.buildPayrollJournal([{reference:'e',netPay:950,employerInsurance:100,components}],mapping));
});
test('lost Odoo create response is recovered by stable reference; no duplicate journal and no duplicate posting',async()=>{
 const s=setup();const api=await moduleFor(s.prisma);
 await assert.rejects(api.postConfiguredPayrollJournal(s.client,'o',mapping));assert.equal(s.status(),'FAILED');assert.equal(s.creates(),1);
 await api.postConfiguredPayrollJournal(s.client,'o',mapping);assert.equal(s.status(),'SENT');assert.equal(s.creates(),1);assert.equal(s.posts(),1);
 await api.postConfiguredPayrollJournal(s.client,'o',mapping);assert.equal(s.creates(),1);assert.equal(s.posts(),1);
});
