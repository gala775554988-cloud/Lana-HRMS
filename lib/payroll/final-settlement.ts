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
  encashRemainingLeave: z.boolean().optional(),
  otherEntitlements: amount,
  deductions: amount,
  reviewNote: z.string().trim().min(10).max(2000)
}).strict().refine(v => !(v.article80 && v.fullEntitlementException) && (!v.article80 || v.reason === "TERMINATION"), "تعارض أسباب الاستحقاق");
export function makeFinalSettlementSnapshot(input: z.infer<typeof finalSettlementInput>, startDate: Date, endDate: Date, outstandingLoans: number) {
  const eosb = calculateEosb({ startDate, endDate, monthlyWage: input.monthlyWage, reason: input.reason, excludedDays: input.excludedDays, article80: input.article80, fullEntitlementException: input.fullEntitlementException });
  const totals = calculateFinalSettlement({ eosb: eosb.eosb, unpaidSalary: input.unpaidSalary, leaveEncashment: input.leaveEncashment, otherEntitlements: input.otherEntitlements, deductions: input.deductions, outstandingLoans: money(outstandingLoans) });
  return { input, startDate: startDate.toISOString(), endDate: endDate.toISOString(), outstandingLoans: money(outstandingLoans), eosb, totals, policy: "SA-LABOR-84-88-ACT365-REVIEW", requiresHrReview: true };
}

export const debtSourceSchema = z.object({kind:z.enum(["LOAN","ADVANCE"]),id:z.string().min(1),amount:amount,version:z.string(),external:z.boolean(),installmentIds:z.array(z.string()).optional()}).strict();
export const settlementPaymentInput = z.object({id:z.string().min(1),action:z.literal("confirm-payment"),reference:z.string().trim().min(5).max(150).transform(v=>v.toUpperCase()),confirmedAmount:amount,reviewedSources:z.literal(true)}).strict();
export const settlementDebtSnapshot = z.object({debtSources:z.array(debtSourceSchema),leaveVersion:z.string().nullable(),lastPaidVersion:z.string().nullable(),leaveDays:z.number().optional()});
export function buildFinalSettlementEntries(snapshot: ReturnType<typeof makeFinalSettlementSnapshot>, sources: z.infer<typeof debtSourceSchema>[]) {
  const rows:{effectType:string;direction:"CREDIT"|"DEBIT";amount:number}[]=[];
  const add=(effectType:string,direction:"CREDIT"|"DEBIT",value:number)=>{if(!Number.isFinite(value)||value<0)throw Error("قيمة تسوية غير صالحة");if(money(value)>0)rows.push({effectType,direction,amount:money(value)});};
  add("EOSB","CREDIT",snapshot.eosb.eosb);
  add("UNPAID_SALARY","CREDIT",snapshot.input.unpaidSalary);
  add("LEAVE_ENCASHMENT","CREDIT",snapshot.input.leaveEncashment);
  add("OTHER_ENTITLEMENTS","CREDIT",snapshot.input.otherEntitlements);
  add("OTHER_DEDUCTIONS","DEBIT",snapshot.input.deductions);
  if(new Set(sources.map(row=>row.kind+":"+row.id)).size!==sources.length || money(sources.reduce((sum,row)=>sum+row.amount,0))!==snapshot.outstandingLoans)throw Error("تعارض مصادر الأقساط");
  for(const row of sources)add(row.kind+":"+row.id,"DEBIT",row.amount);
  const sum=(direction:"CREDIT"|"DEBIT")=>money(rows.filter(row=>row.direction===direction).reduce((s,row)=>s+row.amount,0));
  if(sum("CREDIT")!==snapshot.totals.entitlements || sum("DEBIT")!==snapshot.totals.deductions || money(sum("CREDIT")-sum("DEBIT"))!==snapshot.totals.netSettlement || snapshot.totals.netSettlement<0)throw Error("المخالصة تحتاج مراجعة مالية قبل تأكيد الصرف");
  return rows;
}

export function calculateLeaveEncashment(balance: {accrued:number;used:number}|null, monthlyWage:number) {
  if(!balance || ![balance.accrued,balance.used,monthlyWage].every(Number.isFinite) || balance.accrued<0 || balance.used<0 || monthlyWage<=0)throw Error("يلزم توثيق رصيد الإجازات والأجر الأخير قبل صرف الرصيد");
  const days=money(Math.max(0,balance.accrued-balance.used));
  return {days,amount:money(days*monthlyWage/30)};
}
export function reconcileOdooSettlementInstallments(balance:number, lines:{id:string;amount:number;remotePaid:boolean;localPaidAt:Date|null}[]) {
  const pending=lines.filter(row=>!row.remotePaid&&!row.localPaidAt);
  if(!Number.isFinite(balance)||balance<0||pending.some(row=>!Number.isFinite(row.amount)||row.amount<=0)||new Set(pending.map(row=>row.id)).size!==pending.length||money(pending.reduce((s,row)=>s+row.amount,0))!==money(balance))throw Error("أقساط Odoo غير مطابقة للرصيد؛ يلزم تسوية المصدر أولاً");
  return pending.map(row=>row.id).sort();
}
