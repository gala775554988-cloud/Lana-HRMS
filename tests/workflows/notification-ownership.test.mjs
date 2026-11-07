import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

test("marking one or all notifications as read only touches the session owner's unread rows", async () => {
  const updates = [];
  const { PATCH } = await load("app/api/enterprise/notifications/route.ts", {
    "next/server": { NextResponse: { json: (_body, options) => options?.status ?? 200 } },
    "@/auth": { auth: async () => ({ user: { id: "reader" } }) },
    "@/lib/prisma": { prisma: { notification: { updateMany: async input => updates.push(input) } } },
    "@/lib/enterprise/notifications": { ensureExpiryNotificationsForUser: async () => {} },
    "@/lib/enterprise/social-insurance": { ensureSocialInsuranceAlertsForUser: async () => {} },
  });
  const patch = body => PATCH({ json: async () => body });
  assert.equal(await patch({ all: "true" }), 400);
  assert.equal(await patch({ id: { not: "" } }), 400);
  assert.equal(await patch({ all: true }), 200);
  assert.equal(await patch({ id: "a-notification" }), 200);
  assert.equal(updates.length, 2);
  for (const update of updates) {
    assert.equal(update.where.userId, "reader");
    assert.equal(update.where.readAt, null);
    assert.equal(update.where.OR, undefined);
  }
  assert.equal(updates[1].where.id, "a-notification");
});
