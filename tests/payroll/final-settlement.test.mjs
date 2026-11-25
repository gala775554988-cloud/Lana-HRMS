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

test("settlement ledger reconciles net amount and rejects duplicate debt sources",()=>{
 const snapshot=api.makeFinalSettlementSnapshot(api.finalSettlementInput.parse(input),new Date("2020-01-01"),new Date(Date.parse("2020-01-01")+5*365*86400000),200);
 const source={kind:"LOAN",id:"l1",amount:200,version:"v1",external:false};
 const rows=api.buildFinalSettlementEntries(snapshot,[source]);
 assert.equal(rows.filter(r=>r.direction==="CREDIT").reduce((s,r)=>s+r.amount,0),16500);
 assert.equal(rows.filter(r=>r.direction==="DEBIT").reduce((s,r)=>s+r.amount,0),300);
 assert.throws(()=>api.buildFinalSettlementEntries(snapshot,[{...source,amount:100},{...source,amount:100}]));
});
test("payment attestation requires reviewed sources, amount and reference",()=>{
 const base={id:"s1",action:"confirm-payment",reference:" bank-1 ",confirmedAmount:100,reviewedSources:true};
 assert.equal(api.settlementPaymentInput.parse(base).reference,"BANK-1");
 assert.equal(api.settlementPaymentInput.safeParse({...base,reviewedSources:false}).success,false);
 assert.equal(api.settlementPaymentInput.safeParse({...base,confirmedAmount:-1}).success,false);
});
