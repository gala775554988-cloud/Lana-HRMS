import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../workflows/helpers.mjs';
const api=await load('lib/integrations/odoo/migration/mapping.ts',{zod:await import('zod')});
test('inactive is not inferred to be resigned or dismissed; explicit mapping retains distinction',()=>{
 const config=api.migrationConfigSchema.parse({});assert.equal(api.employeeStatus({active:false},config).status,'INACTIVE');
 const mapped=api.migrationConfigSchema.parse({employeeStatusField:'state',employeeStatusMap:{resigned:'RESIGNED',fired:'DISMISSED'}});
 assert.equal(api.employeeStatus({state:'resigned'},mapped).workingStatus,'RESIGNED');assert.equal(api.employeeStatus({state:'fired'},mapped).status,'TERMINATED');assert.throws(()=>api.employeeStatus({state:'unknown'},mapped));
});
test('financial reconciliation keeps six-decimal source precision and rejects differences below one halala',()=>{
 const lines=[{code:'BASIC',total:'1000.000001'},{code:'HOUSE',total:'200.000001'},{code:'GROSS',total:'1200.000002'},{code:'DED',total:'-100.000001'},{code:'NET',total:'1100.000001'}];
 const mapping=new Map([['HOUSE','ALLOWANCE'],['DED','DEDUCTION']]);assert.equal(api.reconcilePayroll(lines,mapping).net,'1100.000001');
 assert.throws(()=>api.reconcilePayroll(lines.map(row=>row.code==='NET'?{...row,total:'1100.000002'}:row),mapping),/بدقة/);
 assert.throws(()=>api.decimalUnits('1.0000001'));assert.throws(()=>api.decimalUnits('NaN'));assert.equal(api.decimalText(api.decimalUnits('-0.000001')),'-0.000001');
});
test('unknown salary rules, malformed dates and reversed periods are rejected',()=>{
 assert.throws(()=>api.reconcilePayroll([{code:'UNKNOWN',total:1}],new Map()));assert.throws(()=>api.sourceDate('2026-02-30'));assert.throws(()=>api.sourceDate(false));assert.equal(api.nextMonth('2026-12'),'2027-01');
 assert.equal(api.migrationConfigSchema.safeParse({fromMonth:'2026-11',toMonth:'2026-01'}).success,false);
});
