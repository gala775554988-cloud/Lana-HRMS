import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { load } from "../workflows/helpers.mjs";

async function setup(userId = "test-user") {
  const calls = [];
  const route = await load("app/api/employee/preferences/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    zod: { z },
    "@/auth": { auth: async () => userId ? { user: { id: userId } } : null },
    "@/lib/prisma": {
      prisma: {
        employee: { findFirst: async (args) => { calls.push(args); return { id: "own-employee" }; } },
        employeePreference: { upsert: async (args) => { calls.push(args); } },
      },
    },
  });
  return { calls, post: (payload) => route.POST({ json: async () => JSON.parse(payload) }) };
}

test("employee preferences require a session before any database operation", async () => {
  const { calls, post } = await setup(null);
  assert.equal((await post('{"language":"en"}')).status, 401);
  assert.equal(calls.length, 0);
});

test("employee preferences reject owner overrides, Prisma relations and invalid payloads", async () => {
  const { calls, post } = await setup();
  for (const payload of ['{"employeeId":"another-user","language":"en"}', '{"employee":{"connect":{"id":"other"}}}', '{"language":"xx"}', '{}', '{']) {
    assert.equal((await post(payload)).status, 400);
  }
  assert.equal(calls.length, 0);
});

test("employee preferences can update only approved fields for the session owner", async () => {
  const { calls, post } = await setup();
  assert.equal((await post('{"language":"en","timezone":"UTC"}')).status, 200);
  assert.equal(calls[0].where.userId, "test-user");
  assert.equal(calls[1].where.employeeId, "own-employee");
  assert.equal(calls[1].create.employeeId, "own-employee");
  assert.equal(calls[1].update.language, "en");
  assert.equal(calls[1].update.timezone, "UTC");
});
