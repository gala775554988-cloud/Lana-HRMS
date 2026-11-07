import type { Prisma } from "@prisma/client";

export const paidPayslipRun = {
  status: { in: ["PAID", "LOCKED", "ARCHIVED"] },
  paidAt: { not: null },
} satisfies Prisma.PayrollRunWhereInput;

export const latestPayslipFirst = [
  { payrollRun: { period: "desc" } },
  { id: "desc" },
] satisfies Prisma.PayrollItemOrderByWithRelationInput[];
