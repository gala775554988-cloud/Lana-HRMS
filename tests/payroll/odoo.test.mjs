import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { load } from '../workflows/helpers.mjs';
const api = await load('lib/payroll/odoo-payroll.ts', {'node:crypto':crypto,'@/lib/prisma':{prisma:{}}});
const calculations = await load('lib/payroll/calculations.ts');
const materialize = await load('lib/payroll/odoo-materialize.ts', {'@/lib/prisma':{prisma:{}},'./calculations':calculations});
function remote({mutate=false,lineFailure=false}={}) {
 const lines=Array.from({length:1003},(_,index)=>({id:index+1,slip_id:[1,'Slip'],code:`RULE${index}`,name:`Line ${index}`,amount:10,quantity:2,rate:50,total:10,salary_rule_id:[index+1,'Rule'],category_id:[2,'Allowance']}));
 const slip={id:1,employee_id:[10,'Employee'],date_from:'2026-11-01',date_to:'2026-11-30',state:'draft',write_date:'2026-11-01 00:00:00',line_ids:lines.map(row=>row.id)};
 return {lines,client:{fieldsGet:async model=>Object.fromEntries((model==='hr.payslip'?Object.keys(slip):Object.keys(lines[0])).map(key=>[key,{}])),search_read:async(model,domain,fields,options)=>{
   if(model==='hr.payslip') return domain.some(row=>row[1]==='=')?[{write_date:mutate?'changed':slip.write_date,line_ids:slip.line_ids}]:[slip];
   if(lineFailure) throw new Error('Upstream failure must not flatten into a zero payroll');
   const cursor=domain.find(row=>row[0]==='id'&&row[1]==='>')?.[2]??0;
   assert.equal(options.context.active_test,false);assert.equal(options.order,'id asc');return lines.filter(row=>row.id>cursor).slice(0,options.limit);
 }}};
}
test('Odoo imports every original line beyond 500 with quantity/rate/total, including draft slips',async()=>{
 const {client,lines}=remote();let stored;
 const result=await api.fetchDetailedPayslips(client,async(slip,all)=>{assert.equal(slip.state,'draft');stored=all;});
 assert.equal(result.imported,1);assert.equal(stored.length,1003);assert.equal(JSON.stringify(stored),JSON.stringify(lines));
});
test('changed or unavailable Odoo lines never persist a partial slip or silent zero',async()=>{
 for(const options of [{mutate:true},{lineFailure:true}]){let writes=0;const {client}=remote(options);const result=await api.fetchDetailedPayslips(client,async()=>{writes++;});assert.equal(writes,0);assert.equal(result.skipped,1);}
});
test('Odoo rules must reconcile gross and net; unknown lines are never discarded',()=>{
 const lines=[{code:'BASIC',total:1000},{code:'HOUSE',total:200},{code:'GROSS',total:1200},{code:'GOSI',total:-100},{code:'NET',total:1100},{code:'EMPLOYER',total:150}];
 const mapping=new Map([['HOUSE','ALLOWANCE'],['GOSI','DEDUCTION'],['EMPLOYER','EMPLOYER']]);
 const result=materialize.classifyOdooLines(lines,mapping);assert.equal(result.netPay,1100);assert.equal(result.components.length,6);assert.equal(result.deductionTotal,100);
 assert.throws(()=>materialize.classifyOdooLines(lines,new Map()));
 assert.throws(()=>materialize.classifyOdooLines([...lines,{code:'NET',total:100}],mapping));
 assert.throws(()=>materialize.classifyOdooLines(lines.map(row=>row.code==='NET'?{...row,total:900}:row),mapping));
});
