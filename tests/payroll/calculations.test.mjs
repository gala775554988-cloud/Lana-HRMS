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
