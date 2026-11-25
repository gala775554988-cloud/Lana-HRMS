import {test} from "node:test";
import assert from "node:assert/strict";
import {load} from "../workflows/helpers.mjs";
const api=await load("lib/payroll/budget-control.ts");
test("budget counts committed and proposed employer costs without rounding drift",()=>{
 const result=api.compareBudget("1000.00",["400.01","50.10"],["500.00","50.00"]);
 assert.equal(result.exceeded,true);assert.equal(result.remaining,"-0.11");
 assert.equal(api.compareBudget("1000",["300"],["700"]).exceeded,false);
 assert.equal(api.outsideBand("5000.01","3000","5000"),true);
});
test("budget guard identifies blocking versus advisory controls",async()=>{
 const tx={payrollBudgetLimit:{findMany:async()=>[{costCenterId:"c",currency:"SAR",ceiling:"1000",enforce:true}]},payrollSalaryBand:{findMany:async()=>[{positionId:"p",currency:"SAR",minimum:"900",maximum:"1000",enforce:false}]},employee:{findMany:async()=>[{id:"e",positionId:"p"}]},payrollItem:{findMany:async()=>[{grossPay:"100",employerInsurance:"20"}]}};
 const result=await api.inspectPayrollControls(tx,{id:"r",periodId:"period",costCenterId:"c"},[{employeeId:"e",costCenterId:null,currency:"SAR",baseSalary:"800",grossPay:"850",employerInsurance:"50"}]);
 assert.equal(result.find(r=>r.code==="BUDGET_EXCEEDED").blocking,true);assert.equal(result.find(r=>r.code==="SALARY_OUTSIDE_BAND").blocking,false);
});
