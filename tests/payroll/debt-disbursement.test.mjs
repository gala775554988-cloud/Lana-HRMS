import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";
import {load} from "../workflows/helpers.mjs";
const api=await load("lib/payroll/debt-disbursement.ts",{zod:{z}});
const input=api.debtConfirmationSchema.parse({kind:"LOAN",id:"l1",reference:" abc-1 ",amount:"100.00",currency:"SAR",paidDate:"2026-11-24",attested:true});
const source={amount:"100",currency:"SAR",employeeActive:true,disbursementRequired:true,disbursedAt:null,approved:true};
test("external debt disbursement needs exact amount and independent attestation",()=>{
 assert.equal(input.reference,"ABC-1");
 assert.equal(api.verifyDebtConfirmation(input,source,new Date("2026-11-25")).toISOString(),"2026-11-23T21:00:00.000Z");
 for(const change of [{approved:false},{employeeActive:false},{disbursementRequired:false},{disbursedAt:new Date()},{amount:"100.01"},{currency:"USD"}])assert.throws(()=>api.verifyDebtConfirmation(input,{...source,...change},new Date("2026-11-25")));
 assert.throws(()=>api.verifyDebtConfirmation({...input,paidDate:"2026-11-26"},source,new Date("2026-11-25")));
});
