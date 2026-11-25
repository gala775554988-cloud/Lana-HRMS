import {test} from "node:test";
import assert from "node:assert/strict";
import {load} from "../workflows/helpers.mjs";
const api=await load("lib/payroll/report-totals.ts");
const base={period:"2026-11",status:"PAID",currency:"SAR",group:"A",gross:"1000.01",deductions:"100.01",net:"900.00",employer:"120.02"};
test("financial summaries do not mix periods, statuses or currencies",()=>{
 const rows=api.groupPayrollReport([base,base,{...base,currency:"USD"},{...base,status:"DRAFT"},{...base,period:"2026-10"}]);
 assert.equal(rows.length,4);assert.equal(rows[0].gross,2000.02);assert.equal(rows[0].cost,2240.06);assert.equal(rows[0].difference,0);
});
test("reconciliation exposes discrepancy rather than silently modifying a stored salary",()=>{
 const rows=api.groupPayrollReport([{...base,net:"899.99"}]);assert.equal(rows[0].difference,0.01);
 assert.throws(()=>api.groupPayrollReport([{...base,gross:"100.001"}]));
});
