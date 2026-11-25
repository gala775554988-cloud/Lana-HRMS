import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { load } from "../workflows/helpers.mjs";
const calculations=await load("lib/payroll/calculations.ts");
const api=await load("lib/payroll/final-settlement.ts",{zod:{z},"./calculations":calculations});
const input={employeeNumber:"T1",monthlyWage:6000,reason:"NON_RENEWAL",excludedDays:0,article80:false,fullEntitlementException:false,unpaidSalary:1000,leaveEncashment:500,otherEntitlements:0,deductions:100,reviewNote:"Reviewed salary and leave evidence"};
test("final settlement includes actual outstanding debt and remains review-only",()=>{
 const snapshot=api.makeFinalSettlementSnapshot(api.finalSettlementInput.parse(input),new Date("2020-01-01"),new Date(Date.parse("2020-01-01")+5*365*86400000),200);
 assert.equal(snapshot.eosb.eosb,15000);assert.equal(snapshot.totals.netSettlement,16200);assert.equal(snapshot.requiresHrReview,true);
});
test("conflicting legal exceptions and client-supplied payment states rejected",()=>{
 assert.equal(api.finalSettlementInput.safeParse({...input,article80:true}).success,false);
 assert.equal(api.finalSettlementInput.safeParse({...input,reason:"TERMINATION",article80:true,fullEntitlementException:true}).success,false);
 assert.equal(api.finalSettlementInput.safeParse({...input,status:"PAID"}).success,false);
});
