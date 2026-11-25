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
