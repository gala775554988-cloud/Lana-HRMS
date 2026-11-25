import {test} from "node:test";
import assert from "node:assert/strict";
import {load} from "../workflows/helpers.mjs";
const calculations=await load("lib/payroll/calculations.ts");
const api=await load("lib/payroll/bank-preflight.ts",{"./calculations":calculations});
const row={employeeNumber:"E1",iban:"SA0380000000608010167519",primaryAccounts:1,companyId:"C1",gross:5000,deductions:500,net:4500,currency:"SAR"};
test("bank review validates totals, company, account and currency",()=>{
 assert.equal(api.inspectBankReview([row],"C1").ready,true);
 for(const bad of [{net:4499},{primaryAccounts:2},{companyId:"C2"},{currency:"USD"}])assert.equal(api.inspectBankReview([{...row,...bad}],"C1").ready,false);
 assert.equal(api.inspectBankReview([row,row],"C1").ready,false);
});
test("bank review reports suspicious deductions and shared IBAN without inventing a WPS file",()=>{
 const result=api.inspectBankReview([row,{...row,employeeNumber:"E2",deductions:3000,net:2000}],"C1");
 assert.equal(result.ready,true);assert.equal(result.issues.length,2);assert.equal(result.requiresBankSignedWps,true);assert.equal(result.netTotal,6500);
});
