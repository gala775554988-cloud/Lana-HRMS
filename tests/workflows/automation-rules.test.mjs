import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";
import {load} from "./helpers.mjs";
const api=await load("lib/enterprise/automation-rules.ts",{zod:{z}});
test("reminder keys are stable per event and recipient",()=>{
 const key=api.reminderKey("contract","x","2026-12-01","u1");
 assert.equal(key,api.reminderKey("contract","x","2026-12-01","u1"));
 assert.notEqual(key,api.reminderKey("contract","x","2026-12-01","u2"));
 assert.notEqual(key,api.reminderKey("contract","x","2026-12-02","u1"));
 assert.equal(api.riyadhDay(new Date("2026-11-25T22:00:00Z")),"2026-11-26");
});
test("SLA never escalates before deadline or during valid deferral",()=>{
 const now=new Date("2026-11-25T12:00:00Z"),start=new Date("2026-11-24T12:00:00Z");
 assert.equal(api.isApprovalLate(now,start,24),true);
 assert.equal(api.isApprovalLate(now,start,25),false);
 assert.equal(api.isApprovalLate(now,start,24,"2026-11-26T00:00:00Z"),false);
 assert.equal(api.automationPolicySchema.safeParse({...api.defaultAutomationPolicy,noticeDays:0}).success,false);
});
