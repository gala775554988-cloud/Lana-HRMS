import { z } from "zod";
import { calculateEosb, calculateFinalSettlement, money } from "./calculations";
const amount = z.number().finite().min(0).max(9999999999.99);
export const finalSettlementInput = z.object({
  employeeNumber: z.string().trim().min(1).max(100),
  monthlyWage: amount.positive(),
  reason: z.enum(["RESIGNATION","NON_RENEWAL","TERMINATION"]),
  excludedDays: z.number().int().min(0).max(30000),
  article80: z.boolean(),
  fullEntitlementException: z.boolean(),
  unpaidSalary: amount,
  leaveEncashment: amount,
  otherEntitlements: amount,
  deductions: amount,
  reviewNote: z.string().trim().min(10).max(2000)
}).strict().refine(v => !(v.article80 && v.fullEntitlementException) && (!v.article80 || v.reason === "TERMINATION"), "تعارض أسباب الاستحقاق");
export function makeFinalSettlementSnapshot(input: z.infer<typeof finalSettlementInput>, startDate: Date, endDate: Date, outstandingLoans: number) {
  const eosb = calculateEosb({ startDate, endDate, monthlyWage: input.monthlyWage, reason: input.reason, excludedDays: input.excludedDays, article80: input.article80, fullEntitlementException: input.fullEntitlementException });
  const totals = calculateFinalSettlement({ eosb: eosb.eosb, unpaidSalary: input.unpaidSalary, leaveEncashment: input.leaveEncashment, otherEntitlements: input.otherEntitlements, deductions: input.deductions, outstandingLoans: money(outstandingLoans) });
  return { input, startDate: startDate.toISOString(), endDate: endDate.toISOString(), outstandingLoans: money(outstandingLoans), eosb, totals, policy: "SA-LABOR-84-88-ACT365-REVIEW", requiresHrReview: true };
}
