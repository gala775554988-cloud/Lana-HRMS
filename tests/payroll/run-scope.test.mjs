import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Regression checks for payroll run creation's no-silent-scope-change invariant.
// Full integration tests still require a configured isolated test database.
const route = await readFile(new URL('../../app/api/enterprise/payroll/run/route.ts', import.meta.url), 'utf8');

test('a closed or missing linked period is rejected before creation', () => {
  assert.match(route, /period\.status !== "OPEN"/);
  assert.match(route, /period\.startDate\.getTime\(\) !== startDate\.getTime\(\)/);
  assert.match(route, /period\.endDate\.getTime\(\) !== endDate\.getTime\(\)/);
});

test('recalculation of a draft refuses scope changes and explicit employee reselection', () => {
  assert.match(route, /run\.periodStartDate\?\.getTime\(\) !== startDate\.getTime\(\)/);
  assert.match(route, /run\.periodEndDate\?\.getTime\(\) !== endDate\.getTime\(\)/);
  assert.match(route, /fields\.some\(field =>/);
  assert.match(route, /changed \|\| body\.employeeIds !== undefined/);
});

test('period keys and requested employees are validated before recomputation', () => {
  assert.match(route, /صيغة الفترة يجب أن تكون YYYY-MM/);
  assert.match(route, /new Set\(body\.employeeIds\)\.size !== body\.employeeIds\.length/);
});

const detail = await readFile(new URL('../../app/api/enterprise/payroll/run/[id]/route.ts', import.meta.url), 'utf8');
test('both recalculation routes reuse saved employee IDs', () => {
  assert.ok(route.includes('employeeIds: existingIds ?? body.employeeIds'));
  assert.ok(detail.includes('employeeIds,\n      companyId: run.companyId'));
  assert.ok(detail.includes('if (!employeeIds.length)'));
});

const close = await readFile(new URL('../../app/api/enterprise/payroll/periods/[id]/close/route.ts', import.meta.url), 'utf8');
test('period creation and closure use serializable transactions', () => {
  assert.ok(route.includes('isolationLevel: "Serializable"'));
  assert.ok(close.includes('isolationLevel: "Serializable"'));
  assert.ok(close.includes('tx.auditLog.create'));
});
test('settlement checks previously paid overlapping runs', () => {
  assert.ok(detail.includes('paidAt: { not: null }'));
  assert.ok(detail.includes('periodStartDate: { lte: run.periodEndDate }'));
  assert.ok(detail.includes('periodEndDate: { gte: run.periodStartDate }'));
  assert.ok(detail.includes('isolationLevel: "Serializable"'));
});

const engine = await readFile(new URL('../../lib/enterprise/payroll-engine.ts', import.meta.url), 'utf8');
test('failed calculations are not reported as successful', () => {
  for (const source of [route, detail]) {
    assert.ok(source.includes('success: errorCount === 0 && employeeCount > 0'));
    assert.ok(source.includes('status: errorCount || !employeeCount ? 422 : 200'));
  }
});
test('local payroll requires complete calculation and preserves drafts on errors', () => {
  assert.ok(detail.includes('summary.employeeCount !== items.length'));
  assert.ok(engine.includes('if (errorCount || !employees.length) return'));
  assert.ok(engine.includes('!Number.isFinite(breakdown[field])'));
  assert.ok(engine.includes('!matchedIds.has(employeeId)'));
});

test('failed drafts recover the original employee scope', () => {
  assert.ok(route.includes('payroll.scope.'));
  assert.ok(detail.includes('payroll.scope.'));
  assert.ok(engine.includes('scope.employeeIds ?? employees.map(employee => employee.id)'));
  assert.ok(detail.includes('employeeIds = scope.employeeIds'));
});
