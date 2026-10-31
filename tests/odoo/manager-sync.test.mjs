import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

async function setup(parent, { managerId = 'old', odooParentId = 1, snapshot = [1, 'Old Manager'], local = { id: 'new', firstName: 'Old', lastName: 'Name' }, name = 'Updated Manager' } = {}) {
  const employee = { id: 'child', odooId: 10, managerId, odooParentId, odooRawData: { parent_id: snapshot, preserved: true } };
  const writes = []; let clears = 0;
  const prisma = { employee: {
    findUnique: async ({ where }) => where.id ? employee : local,
    update: async ({ where, data }) => { writes.push({ where, data }); return data; },
  } };
  const context = vm.createContext({});
  const source = await fs.readFile(new URL('../../lib/integrations/odoo/manager-sync.ts', import.meta.url), 'utf8');
  const mod = new vm.SourceTextModule(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, { context });
  await mod.link(async path => {
    const exports = path === '@/lib/prisma' ? { prisma } : { clearMemoryCache: () => clears++ };
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await mod.evaluate();
  const client = { read: async (_model, ids) => ids[0] === 10 ? [{ id: 10, parent_id: parent }] : [{ id: ids[0], name }] };
  return { run: source => mod.namespace.syncEmployeeManager(client, 'child', source), writes, cleared: () => clears };
}

test('changing a manager updates both the relationship and renamed manager', async () => {
  const s = await setup([2, 'Stale Name']);
  assert.equal((await s.run()).changed, true);
  assert.equal(s.writes[0].where.id, 'new');
  assert.equal(s.writes[0].data.firstName, 'Updated');
  assert.equal(s.writes[1].data.managerId, 'new');
  assert.equal(s.writes[1].data.odooRawData.preserved, true);
  assert.equal(s.cleared(), 1);
});
test('removing the Odoo manager clears the old local manager', async () => {
  const s = await setup(false);
  await s.run();
  assert.equal(s.writes[0].data.managerId, null);
  assert.equal(s.writes[0].data.odooParentId, null);
  assert.equal(s.writes[0].data.odooRawData.parent_id, false);
});
test('an unsynced manager replaces stale links and retains the authoritative display name', async () => {
  const s = await setup([2, 'New Manager'], { local: null });
  await s.run();
  assert.equal(s.writes[0].data.managerId, null);
  assert.equal(s.writes[0].data.odooRawData.parent_id[1], 'Updated Manager');
});
test('unchanged manager metadata does not write or invalidate caches', async () => {
  const s = await setup([2, 'Updated Manager'], { managerId: 'new', odooParentId: 2, snapshot: [2, 'Updated Manager'], local: { id: 'new', firstName: 'Updated', lastName: 'Manager' } });
  assert.equal((await s.run()).changed, false);
  assert.equal(s.writes.length, 0);
  assert.equal(s.cleared(), 0);
});
test('missing parent fields and unrelated source records never clear the manager', async () => {
  const s = await setup(false);
  assert.equal((await s.run({ id: 10 })).changed, false);
  assert.equal((await s.run({ id: 20, parent_id: false })).changed, false);
  assert.equal(s.writes.length, 0);
});
