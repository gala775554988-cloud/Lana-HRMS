import {test} from "node:test";
import assert from "node:assert/strict";
import {load} from "../workflows/helpers.mjs";
const calculations=await load("lib/payroll/calculations.ts"),review=await load("lib/payroll/debt-review.ts");
const settlement=await load("lib/payroll/settlement.ts",{"./calculations":calculations,"./debt-review":review});
const api=await load("lib/payroll/local-journal.ts",{"./settlement":settlement});
const snapshot={currency:"SAR",baseSalary:1000,allowanceTotal:0,bonusTotal:0,overtimeTotal:0,grossPay:1000,insuranceDeduction:100,taxTotal:0,absenceDeduction:0,lateDeduction:0,penaltyDeduction:0,otherDeductionTotal:0,loanDeduction:100,advanceDeduction:0,deductionTotal:200,netPay:800,loanAllocations:[{id:"l1",amount:100}],advanceAllocations:[],gosi:{employerAmount:120}};
const item={id:"i",employeeId:"e",currency:"SAR",costCenterId:null,employerInsurance:120,snapshot};
test("local accounting classification balances employer expenses and receivables by currency",()=>{
 const result=api.buildLocalPayrollJournal([item,{...item,id:"j",currency:"USD",snapshot:{...snapshot,currency:"USD"}}],"c1");
 assert.equal(result.totals.length,2);assert.equal(result.totals[0].debit,"1120.00");assert.equal(result.totals[0].credit,"1120.00");
 assert.equal(result.lines.find(r=>r.accountRole==="EMPLOYEE_RECEIVABLE").credit,"100.00");assert.equal(result.lines[0].costCenterId,"c1");
 assert.throws(()=>api.buildLocalPayrollJournal([item,item],null));assert.throws(()=>api.buildLocalPayrollJournal([{...item,employerInsurance:121}],null));
});
