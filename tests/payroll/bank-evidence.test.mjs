import {test} from "node:test";
import assert from "node:assert/strict";
import {load} from "../workflows/helpers.mjs";
const calc=await load("lib/payroll/calculations.ts");
const api=await load("lib/payroll/bank-evidence.ts",{"./calculations":calc});
const csv='employee_number,iban,currency,net_amount\n"E1","SA0380000000608010167519",SAR,4500.00';
test("separate report matches cents without asserting signature validation",()=>{
 const rows=api.parseBankExtract(csv);
 const result=api.matchBankExtract(rows,rows);
 assert.equal(result.matched,true);assert.equal(result.actualTotal,4500);assert.equal(result.signatureVerified,false);assert.equal(result.mudadSubmitted,false);
});
test("missing, duplicate, unexpected and changed amount cannot match",()=>{
 const rows=api.parseBankExtract(csv);
 assert.equal(api.matchBankExtract(rows,[]).matched,false);
 assert.equal(api.matchBankExtract(rows,[...rows,...rows]).matched,false);
 assert.equal(api.matchBankExtract(rows,[{...rows[0],net:4500.01}]).matched,false);
 assert.equal(api.matchBankExtract(rows,[{...rows[0],employeeNumber:"E2"}]).matched,false);
 assert.throws(()=>api.parseBankExtract(csv.replace("4500.00","4500.001")));
});
