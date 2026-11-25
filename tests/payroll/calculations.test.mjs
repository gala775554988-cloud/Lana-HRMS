import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../workflows/helpers.mjs';
const api = await load('lib/payroll/calculations.ts');
const policy = { id: 'legacy', cohort: 'LEGACY', effectiveFrom: new Date('2020-01-01'), employeeRate: 9.75, employerRate: 11.75, minimumWage: 1500, maximumWage: 45000, housingIncluded: true };
const input = { saudi: true, active: true, cohort: 'LEGACY', asOf: new Date('2026-11-30'), basic: 8000, housing: 2000, policies: [policy] };
test('legacy Saudi GOSI uses basic plus housing and keeps employer charge out of employee deduction', () => {
  const result = api.calculateGosi(input); assert.equal(result.employeeAmount, 975); assert.equal(result.employerAmount, 1175); assert.equal(result.subjectWage, 10000);
});
test('non-Saudis and inactive coverage get no rates or deduction', () => {
  for (const override of [{ saudi: false }, { active: false }]) { const result = api.calculateGosi({ ...input, ...override }); assert.equal(result.employeeRate, null); assert.equal(result.employerRate, null); assert.equal(result.employeeAmount, 0); }
});
test('policy caps, floor and housing exclusions are explicit and effective-dated', () => {
  assert.equal(api.calculateGosi({ ...input, basic: 50000 }).subjectWage, 45000);
  assert.equal(api.calculateGosi({ ...input, basic: 100, housing: 0 }).subjectWage, 1500);
  assert.equal(api.calculateGosi({ ...input, policies: [{ ...policy, housingIncluded: false }] }).subjectWage, 8000);
  const future = { ...policy, id: 'future', cohort: 'NEW', effectiveFrom: new Date('2027-01-01'), employeeRate: 10.25 };
  assert.equal(api.calculateGosi({ ...input, cohort: 'NEW', asOf: new Date('2027-02-01'), policies: [policy, future] }).employeeAmount, 1025);
  assert.throws(() => api.calculateGosi({ ...input, cohort: 'NEW', policies: [future] }));
  assert.throws(() => api.calculateGosi({ ...input, policies: [policy, policy] }));
});
test('coverage uses first-ever enrollment or assigned cohort, never assumes hiring date is first coverage', () => {
  assert.equal(api.resolveGosiCohort(null, new Date('2020-01-01'), new Date('2024-07-03')), 'LEGACY');
  assert.equal(api.resolveGosiCohort(null, new Date('2025-01-01'), new Date('2024-07-03')), 'NEW');
  assert.throws(() => api.resolveGosiCohort(null, null, new Date()));
});
test('EOSB resignation tiers, full termination entitlement and reviewed Article 80 exception', () => {
  const base = { startDate: new Date('2020-01-01'), endDate: new Date('2020-01-01'), monthlyWage: 6000, reason: 'RESIGNATION' };
  const at = years => ({ ...base, endDate: new Date(base.startDate.getTime() + years * 365 * 86400000) });
  assert.equal(api.calculateEosb(at(1)).eosb, 0);
  assert.equal(api.calculateEosb(at(3)).eosb, 3000);
  assert.equal(api.calculateEosb(at(6)).eosb, 14000);
  assert.equal(api.calculateEosb(at(10)).eosb, 45000);
  assert.equal(api.calculateEosb({ ...at(6), reason: 'TERMINATION' }).eosb, 21000);
  assert.equal(api.calculateEosb({ ...at(6), article80: true }).eosb, 0);
});
test('bank review validates Saudi IBAN checksum, currency and amounts', () => {
  assert.equal(api.validSaudiIban('SA0380000000608010167519'), true);
  assert.equal(api.validSaudiIban('SA0380000000608010167510'), false);
  const row = { employeeNumber: 'E1', iban: 'SA0380000000608010167519', net: 1000, currency: 'SAR' };
  assert.match(api.buildBankReviewCsv([row]), /1000.00/);
  assert.throws(() => api.buildBankReviewCsv([{ ...row, net: -1 }]));
  assert.throws(() => api.buildBankReviewCsv([{ ...row, employeeNumber: '=1+1' }]));
  assert.throws(() => api.buildBankReviewCsv([{ ...row, currency: 'USD' }]));
});
test('final settlement includes reviewed leave encashment, unpaid wages and financial offsets', () => {
 const result = api.calculateFinalSettlement({ eosb: 10000, unpaidSalary: 2000, leaveEncashment: 1000, otherEntitlements: 500, deductions: 300, outstandingLoans: 700 });
 assert.equal(result.entitlements,13500);assert.equal(result.deductions,1000);assert.equal(result.netSettlement,12500);
 assert.throws(()=>api.calculateFinalSettlement({eosb:-1,unpaidSalary:0,leaveEncashment:0,otherEntitlements:0,deductions:0,outstandingLoans:0}));
});

test('invalid coverage dates and excessive excluded service days are rejected', () => {
  assert.throws(() => api.resolveGosiCohort(null, new Date('invalid'), new Date('2024-07-03')));
  assert.throws(() => api.resolveGosiCohort('UNKNOWN', null, null));
  assert.throws(() => api.calculateEosb({ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-02'), monthlyWage: 6000, reason: 'TERMINATION', excludedDays: 2 }));
});
test('bank review rejects duplicate employee rows and whitespace-prefixed formulas', () => {
  const row = { employeeNumber: 'E1', iban: 'SA0380000000608010167519', net: 1000, currency: 'SAR' };
  assert.throws(() => api.buildBankReviewCsv([row, {...row}]));
  assert.throws(() => api.buildBankReviewCsv([{...row, employeeNumber: '  =1+1'}]));
});

test("advance final installment clears both upward and downward rounding", () => {
  for (const [amount, monthlyDeduction, installments, expected] of [[100,33.33,3,[33.33,33.33,33.34]], [100,16.67,6,[16.67,16.67,16.67,16.67,16.67,16.65]], [0.01,0.01,1,[0.01]]]) {
    const amounts = expected.map((_,paidInstallments) => api.advanceSchedule({amount,monthlyDeduction,installments,paidInstallments}).next);
    assert.deepEqual(amounts,expected);
    assert.equal(Math.round(amounts.reduce((a,b)=>a+b,0)*100),Math.round(amount*100));
    assert.equal(api.advanceSchedule({amount,monthlyDeduction,installments,paidInstallments:installments}).next,0);
  }
});
test("advance stops once principal is reached and rejects inconsistent counts", () => {
  const input={amount:0.03,monthlyDeduction:0.02,installments:3,paidInstallments:1};
  assert.equal(api.advanceSchedule(input).next,0.01);
  assert.equal(api.advanceSchedule(input).completeAfterNext,true);
  assert.equal(api.advanceSchedule({...input,paidInstallments:2}).next,0);
  assert.throws(()=>api.advanceSchedule({...input,paidInstallments:4}));
});

test("approved paid annual leave excludes attendance deductions on Saudi calendar dates", () => {
  const leave = {startDate:new Date("2026-11-09T21:00:00Z"),endDate:new Date("2026-11-12T20:59:00Z"),leaveType:{code:"ANNUAL",isPaid:true}};
  assert.equal(api.isApprovedPaidAnnualLeaveDay(new Date("2026-11-10T05:00:00Z"),[leave]),true);
  assert.equal(api.isApprovedPaidAnnualLeaveDay(new Date("2026-11-13T05:00:00Z"),[leave]),false);
  assert.equal(api.isApprovedPaidAnnualLeaveDay(new Date("2026-11-10T05:00:00Z"),[{...leave,leaveType:{code:"ANNUAL",isPaid:false}}]),false);
  assert.equal(api.isApprovedPaidAnnualLeaveDay(new Date("2026-11-10T05:00:00Z"),[{...leave,leaveType:{code:"SICK",isPaid:true}}]),false);
});

test("new GOSI schedule respects July 2026 increase and separates employer share",()=>{
 const policies=api.standardSaudiGosiSchedule(1500).map((p,i)=>({...p,id:String(i)}));
 const input={saudi:true,active:true,cohort:"NEW",basic:8000,housing:2000,policies};
 assert.equal(api.calculateGosi({...input,asOf:new Date("2026-06-30T12:00:00Z")}).employeeAmount,1025);
 const current=api.calculateGosi({...input,asOf:new Date("2026-07-01")});
 assert.equal(current.employeeAmount,1075);assert.equal(current.employerAmount,1275);
});
test("non-Saudi hazard coverage charges employer only, with explicit policy",()=>{
 const policy={id:"h",cohort:"NON_SAUDI_HAZARDS",effectiveFrom:new Date("2024-01-01"),employeeRate:0,employerRate:2,minimumWage:0,maximumWage:45000,housingIncluded:true};
 const result=api.calculateGosi({saudi:false,active:true,cohort:policy.cohort,asOf:new Date("2026-11-01"),basic:3000,housing:1000,registeredWage:5000,policies:[policy]});
 assert.equal(result.employeeAmount,0);assert.equal(result.employerAmount,100);
});
test("sick leave tiers carry across payroll periods and unpaid days are not duplicated",()=>{
 const sick={startDate:new Date("2026-01-01"),endDate:new Date("2026-02-09"),days:40,leaveType:{code:"SICK",isPaid:true}};
 const unpaid={startDate:new Date("2026-02-10"),endDate:new Date("2026-02-11"),days:2,leaveType:{code:"UNPAID",isPaid:false}};
 const result=api.calculateLeavePayroll(new Date("2026-02-01"),new Date("2026-02-28"),[sick,unpaid],6000);
 assert.equal(result.sickQuarterDays,9);assert.equal(result.unpaidDays,2);assert.equal(result.deduction,850);assert.equal(result.coveredDays.length,11);
});
