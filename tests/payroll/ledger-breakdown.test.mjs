import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../workflows/helpers.mjs";
const calculations = await load("lib/payroll/calculations.ts");
const { buildPayrollLedgerBreakdown } = await load("lib/payroll/settlement.ts", {"./calculations": calculations});
const snapshot = {baseSalary:1000,allowanceTotal:200,bonusTotal:50,overtimeTotal:25,grossPay:1275,insuranceDeduction:100,taxTotal:0,absenceDeduction:10,lateDeduction:5,penaltyDeduction:0,otherDeductionTotal:0,loanDeduction:20,advanceDeduction:33.34,deductionTotal:168.34,netPay:1106.66,loanAllocations:[{id:"loan",amount:20}],advanceAllocations:[{id:"advance",amount:33.34}]};
test("itemized postings reconcile exactly without duplicating totals",()=>{
  const rows=buildPayrollLedgerBreakdown(snapshot);
  assert.equal(Math.round(rows.filter(r=>r.direction==="CREDIT").reduce((s,r)=>s+r.amount,0)*100),127500);
  assert.equal(Math.round(rows.filter(r=>r.direction==="DEBIT").reduce((s,r)=>s+r.amount,0)*100),16834);
  assert.equal(rows.find(r=>r.effectType==="ADVANCE:advance").amount,33.34);
  assert.equal(rows.find(r=>r.effectType==="LOAN:loan").amount,20);
  assert.equal(new Set(rows.map(r=>r.effectType)).size,rows.length);
});
test("mismatched, duplicate or negative financial sources are rejected",()=>{
  assert.throws(()=>buildPayrollLedgerBreakdown({...snapshot,netPay:1106.65}));
  assert.throws(()=>buildPayrollLedgerBreakdown({...snapshot,advanceAllocations:[{id:"advance",amount:33.33}]}));
  assert.throws(()=>buildPayrollLedgerBreakdown({...snapshot,loanAllocations:[{id:"loan",amount:10},{id:"loan",amount:10}]}));
  assert.throws(()=>buildPayrollLedgerBreakdown({...snapshot,bonusTotal:-50}));
});
