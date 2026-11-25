import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { load } from "../workflows/helpers.mjs";

function setup({ approved = true } = {}) {
  const executions = new Map(), ledger = new Map();
  const keyFor = row => [row.sourceType, row.sourceId, row.effectType].join(":");
  const duplicate = () => new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "6.0.0" });
  const tx = {
    leaveRequest: { findUnique: async () => ({ employeeId: "e", status: approved ? "APPROVED" : "PENDING" }) },
    overtimeRequest: { findUnique: async () => ({ employeeId: "e", status: approved ? "APPROVED" : "PENDING" }) },
    employeeBonus: { findUnique: async () => ({ employeeId: "e", status: approved ? "APPROVED" : "PENDING" }) },
    employeeSalaryAdvance: { findUnique: async () => ({ employeeId: "e", status: approved ? "APPROVED" : "PENDING" }) },
    payrollItem: { findUnique: async () => ({ employeeId: "e", payrollRunId: "run", payrollRun: { status: approved ? "PAID" : "DRAFT" } }) },
    employeeRequestExecution: {
      create: async ({ data }) => {
        const key = keyFor(data);
        if (executions.has(key)) throw duplicate();
        executions.set(key, data);
        return data;
      }
    },
    employeeFinancialEntry: {
      create: async ({ data }) => {
        const key = keyFor(data);
        if (ledger.has(key)) throw duplicate();
        const record = { ...data, amount: new Prisma.Decimal(data.amount) };
        ledger.set(key, record);
        return record;
      },
      findUnique: async ({ where }) => ledger.get(keyFor(where.sourceType_sourceId_effectType)) ?? null,
      groupBy: async () => [],
    },
  };
  const prisma = { ...tx, $transaction: async callback => callback(tx) };
  return { prisma, executions, ledger };
}

async function service(db) {
  return load("lib/enterprise/employee-financial-ledger.ts", {
    "@prisma/client": { Prisma }, "@/lib/prisma": { prisma: db.prisma }
  });
}

const approvedBonus = { employeeId: "e", sourceType: "BONUS", sourceId: "b1",
  effectType: "PAYROLL_ACCRUAL", direction: "CREDIT", amount: "175.25", currency: "SAR" };

test("the same approved source and effect posts only once across retries", async () => {
  const db = setup(), api = await service(db);
  const first = await api.postApprovedFinancialEffect(approvedBonus);
  const second = await api.postApprovedFinancialEffect(approvedBonus);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(db.executions.size, 1);
  assert.equal(db.ledger.size, 1);
});

test("a source cannot be reused with a changed amount", async () => {
  const db = setup(), api = await service(db);
  await api.postApprovedFinancialEffect(approvedBonus);
  await assert.rejects(api.postApprovedFinancialEffect({ ...approvedBonus, amount: "180.00" }), /conflict/);
  assert.equal(db.ledger.size, 1);
});

test("unapproved or monetary annual leave deductions are rejected", async () => {
  const db = setup({ approved: false }), api = await service(db);
  await assert.rejects(api.postApprovedFinancialEffect(approvedBonus), /not approved/);
  assert.equal(db.ledger.size, 0);
  const approved = await service(setup());
  await assert.rejects(approved.postApprovedFinancialEffect({
    employeeId: "e", sourceType: "LEAVE", sourceId: "l1",
    effectType: "APPROVAL", direction: "DEBIT", amount: "50.00"
  }), /not a salary deduction/);
});

test("an approved advance does not book cash until disbursement", async () => {
  const db = setup(), api = await service(db);
  await assert.rejects(api.postApprovedFinancialEffect({
    employeeId: "e", sourceType: "ADVANCE", sourceId: "a1",
    effectType: "APPROVAL", direction: "CREDIT", amount: "200.00"
  }), /not evidence of disbursement/);
});

test("financial summaries preserve cents beyond safe JavaScript integer range", async () => {
  const db = setup();
  db.prisma.employeeFinancialEntry.groupBy = async () => [
    { currency: "SAR", direction: "CREDIT", _sum: { amount: new Prisma.Decimal("9007199254740993.25") } },
    { currency: "SAR", direction: "DEBIT", _sum: { amount: new Prisma.Decimal("9007199254740993.24") } },
    { currency: "USD", direction: "CREDIT", _sum: { amount: new Prisma.Decimal("12.30") } }
  ];
  const api = await service(db);
  assert.deepEqual(JSON.parse(JSON.stringify(await api.employeeFinancialSummary("e"))), [
    { currency: "SAR", credits: "9007199254740993.25", debits: "9007199254740993.24", net: "0.01" },
    { currency: "USD", credits: "12.30", debits: "0.00", net: "12.30" }
  ]);
});
