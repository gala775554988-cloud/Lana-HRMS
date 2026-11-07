import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { load } from "../workflows/helpers.mjs";

test("equipment import matches the employee source and updates the same local asset on retry", async () => {
  const assets = new Map();
  let source = "test-source";
  const tx = {
    appSetting: { findUnique: async () => ({ value: source }) },
    employee: { findUnique: async ({ where }) => where.odooId === 7 ? { id: "local-employee" } : null },
    asset: {
      findUnique: async ({ where }) => assets.get(where.assetTag) ?? null,
      findFirst: async () => null,
      upsert: async ({ where, create, update }) => assets.set(where.assetTag, assets.has(where.assetTag) ? { ...assets.get(where.assetTag), ...update } : create),
    },
  };
  const { importOdooAssets } = await load("lib/integrations/odoo/assets.ts", {
    "node:crypto": { createHash },
    "@/lib/prisma": { prisma: { $transaction: async callback => callback(tx) } },
  });
  const client = {
    execute: async () => ({ employee_id: { type: "many2one", relation: "hr.employee" } }),
    searchRead: async () => [{ id: 123, name: "Laptop", employee_id: [7, "Test employee"] }],
  };
  assert.equal((await importOdooAssets(client, "test-source")).createdCount, 1);
  assert.equal((await importOdooAssets(client, "test-source")).updatedCount, 1);
  assert.equal(assets.size, 1);
  assert.equal([...assets.values()][0].assignedEmployeeId, "local-employee");
  source = "unrelated-source";
  await assert.rejects(() => importOdooAssets(client, "test-source"), /غير مطابق/);
  assert.equal(assets.size, 1);
});
