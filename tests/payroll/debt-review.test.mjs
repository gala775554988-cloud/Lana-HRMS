import {test} from "node:test";
import assert from "node:assert/strict";
import {load} from "../workflows/helpers.mjs";
const api=await load("lib/payroll/debt-review.ts");
const debt={sourceType:"LOAN",sourceId:"l1",employeeId:"e1",principal:"100",currency:"SAR"};
const record={...debt,decision:"VERIFIED",evidenceReference:"BANK-1"};
test("historical approval is not accepted as disbursement evidence",async()=>{
 assert.equal(api.debtReviewVerified(debt,null),false);
 for(const changed of [{decision:"UNVERIFIED"},{decision:"NOT_DISBURSED"},{evidenceReference:null},{principal:"100.01"},{employeeId:"other"},{currency:"USD"}])assert.equal(api.debtReviewVerified(debt,{...record,...changed}),false);
 assert.equal(api.debtReviewVerified(debt,record),true);
 await assert.rejects(api.requireLegacyDebtReview({payrollDebtReview:{findMany:async()=>[]}},[debt]),/مستند صرف/);
 await api.requireLegacyDebtReview({payrollDebtReview:{findMany:async()=>[record]}},[debt]);
});
