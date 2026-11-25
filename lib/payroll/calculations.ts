export function money(value: number) {
  if (!Number.isFinite(value)) throw new Error("قيمة مالية غير صالحة");
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export type GosiPolicyInput = { id: string; cohort: string; effectiveFrom: Date; effectiveTo?: Date | null; employeeRate: number; employerRate: number; minimumWage: number; maximumWage: number; housingIncluded: boolean };
export function calculateGosi(input: { saudi: boolean; active: boolean; cohort: string; asOf: Date; basic: number; housing: number; registeredWage?: number; policies: GosiPolicyInput[] }) {
  if ((!input.saudi && input.cohort !== "NON_SAUDI_HAZARDS") || !input.active) return { applicable: false, subjectWage: 0, employeeRate: null, employerRate: null, employeeAmount: 0, employerAmount: 0, policyId: null };
  if (![input.basic, input.housing].every(value => Number.isFinite(value) && value >= 0)) throw new Error("أجر التأمينات غير صالح");
  if(input.registeredWage!==undefined && (!Number.isFinite(input.registeredWage)||input.registeredWage<=0)) throw Error("الأجر المسجل في التأمينات غير صالح");
  const candidates = input.policies.filter(policy => policy.cohort === input.cohort && policy.effectiveFrom <= input.asOf && (!policy.effectiveTo || policy.effectiveTo >= input.asOf));
  if (candidates.length !== 1) throw new Error("يجب تحديد سياسة تأمينات واحدة سارية لشريحة الموظف");
  const policy = candidates[0];
  if (![policy.employeeRate, policy.employerRate, policy.minimumWage, policy.maximumWage].every(Number.isFinite) || policy.employeeRate < 0 || policy.employerRate < 0 || policy.employeeRate > 100 || policy.employerRate > 100 || policy.minimumWage < 0 || policy.maximumWage < policy.minimumWage) throw new Error("سياسة التأمينات غير صالحة");
  if(input.cohort==="NON_SAUDI_HAZARDS" && (input.saudi || policy.employeeRate!==0)) throw Error("سياسة الأخطار المهنية لغير السعودي لا تخصم من الموظف");
  const subjectWage = money(Math.min(policy.maximumWage, Math.max(policy.minimumWage, input.registeredWage ?? (input.basic + (policy.housingIncluded ? input.housing : 0)))));
  return { applicable: true, subjectWage, employeeRate: policy.employeeRate, employerRate: policy.employerRate, employeeAmount: money(subjectWage * policy.employeeRate / 100), employerAmount: money(subjectWage * policy.employerRate / 100), policyId: policy.id };
}
export function resolveGosiCohort(explicit: string | null, firstCoverageDate: Date | null, newSystemCutoff: Date | null) {
  if (explicit) {
    if (!["NEW", "LEGACY"].includes(explicit)) throw new Error("شريحة التأمينات غير صالحة");
    return explicit;
  }
  if (!firstCoverageDate || !newSystemCutoff || !Number.isFinite(firstCoverageDate.getTime()) || !Number.isFinite(newSystemCutoff.getTime())) throw new Error("حدد شريحة التأمينات أو تاريخ أول اشتراك وتاريخ سريان النظام الجديد");
  return firstCoverageDate >= newSystemCutoff ? "NEW" : "LEGACY";
}
export function calculateEosb(input: { startDate: Date; endDate: Date; monthlyWage: number; reason: "RESIGNATION" | "NON_RENEWAL" | "TERMINATION"; excludedDays?: number; article80?: boolean; fullEntitlementException?: boolean }) {
  if (!Number.isFinite(input.startDate.getTime()) || !Number.isFinite(input.endDate.getTime()) || input.endDate < input.startDate || !Number.isFinite(input.monthlyWage) || input.monthlyWage < 0 || !["RESIGNATION", "NON_RENEWAL", "TERMINATION"].includes(input.reason)) throw new Error("بيانات التصفية غير صالحة");
  const excluded = input.excludedDays ?? 0;
  if (!Number.isSafeInteger(excluded) || excluded < 0) throw new Error("أيام الاستبعاد غير صالحة");
  const elapsedDays = Math.floor((input.endDate.getTime() - input.startDate.getTime()) / 86400000);
  if (excluded > elapsedDays) throw new Error("أيام الاستبعاد تتجاوز مدة الخدمة");
  const days = elapsedDays - excluded;
  const years = days / 365; // Explicit ACT/365 estimate; final statutory calendar review required.
  const gross = money(input.monthlyWage * (Math.min(years, 5) / 2 + Math.max(years - 5, 0)));
  const fraction = input.article80 ? 0 : input.reason !== "RESIGNATION" || input.fullEntitlementException ? 1 : years < 2 ? 0 : years < 5 ? 1 / 3 : years < 10 ? 2 / 3 : 1;
  return { serviceDays: days, serviceYears: years, grossEntitlement: gross, entitlementFraction: fraction, eosb: money(gross * fraction), calculationBasis: "ACT/365", requiresHrReview: true };
}
export function validSaudiIban(value: string) {
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^SA\d{22}$/.test(iban)) return false;
  const rotated = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rotated) for (const digit of /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}
export function buildBankReviewCsv(rows: { employeeNumber: string; iban: string; net: number; currency: string }[]) {
  if (!rows.length) throw new Error("المسير فارغ");
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const employeeNumbers = new Set<string>();
  for (const row of rows) {
    const key = row.employeeNumber.trim();
    if (!key || employeeNumbers.has(key) || /^[=+@\-]/.test(key)) throw new Error("رقم موظف مكرر أو غير صالح في ملف التحويل");
    employeeNumbers.add(key);
  }
  for (const row of rows) if (!validSaudiIban(row.iban) || !Number.isFinite(row.net) || row.net <= 0 || row.currency !== "SAR" || /^[=+@\-\t\r\n]/.test(row.employeeNumber)) throw new Error(`بيانات التحويل غير صالحة للموظف ${row.employeeNumber}`);
  return '\uFEFF' + ['employee_number,iban,currency,net_amount', ...rows.map(row => [escape(row.employeeNumber), escape(row.iban.replace(/\s/g, '').toUpperCase()), 'SAR', money(row.net).toFixed(2)].join(','))].join('\r\n');
}

export function calculateFinalSettlement(input: { eosb: number; unpaidSalary: number; leaveEncashment: number; otherEntitlements: number; deductions: number; outstandingLoans: number }) {
  if (!Object.values(input).every(value => Number.isFinite(value) && value >= 0)) throw new Error("مبالغ التصفية غير صالحة");
  const entitlements = money(input.eosb + input.unpaidSalary + input.leaveEncashment + input.otherEntitlements);
  const deductions = money(input.deductions + input.outstandingLoans);
  return { entitlements, deductions, netSettlement: money(entitlements - deductions), requiresHrReview: true };
}

/** Calculate the scheduled balance in integer halalas. Prior installments are
 * assumed to have used the stored monthly amount; the last one absorbs rounding.
 * Previously closed records are not reopened automatically. */
export function advanceSchedule(input: { amount: number; monthlyDeduction: number; installments: number; paidInstallments: number }) {
  const { amount, monthlyDeduction, installments, paidInstallments } = input;
  const principal = Math.round(amount * 100), monthly = Math.round(monthlyDeduction * 100);
  if (!Number.isSafeInteger(principal) || principal <= 0 || !Number.isSafeInteger(monthly) || monthly <= 0 ||
      !Number.isSafeInteger(installments) || installments < 1 || !Number.isSafeInteger(paidInstallments) || paidInstallments < 0 || paidInstallments > installments) {
    throw new Error("بيانات أقساط السلفة غير صالحة");
  }
  // Avoid multiplication overflow for large installment counts.
  const paidBeforeFinal = Math.min(paidInstallments, installments - 1, Math.ceil(principal / monthly));
  const remaining = paidInstallments === installments ? 0 : Math.max(0, principal - paidBeforeFinal * monthly);
  const next = paidInstallments === installments - 1 ? remaining : Math.min(monthly, remaining);
  return { remaining: remaining / 100, next: next / 100, completeAfterNext: next === remaining };
}

/** Compare calendar dates in the company's Saudi time zone; never treat paid
 * approved annual leave as an absence or tardiness deduction. Other leave
 * categories retain their own reviewed statutory payroll rules. */
export function isApprovedPaidAnnualLeaveDay(workDate: Date, leaves: { startDate: Date; endDate: Date; leaveType: { code: string; isPaid: boolean } }[]) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });
  const dayKey = (date: Date) => {
    const parts = formatter.formatToParts(date);
    return Number(["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value ?? "").join(""));
  };
  const day = dayKey(workDate);
  return leaves.some(leave => leave.leaveType.isPaid && leave.leaveType.code.toUpperCase().startsWith("ANNUAL") && dayKey(leave.startDate) <= day && dayKey(leave.endDate) >= day);
}

/** Reference rates for standard full coverage; exceptional and GCC schemes
 * require their own verified policy. No existing rate is overwritten. */
export function standardSaudiGosiSchedule(minimumWage:number) {
 if(!Number.isFinite(minimumWage)||minimumWage<0||minimumWage>45000)throw Error("حد الأجر غير صالح");
 const periods=[["2024-07-03","2025-06-30",9],["2025-07-01","2026-06-30",9.5],["2026-07-01","2027-06-30",10],["2027-07-01","2028-06-30",10.5],["2028-07-01",null,11]] as const;
 return periods.map(([from,to,pension])=>({cohort:"NEW",effectiveFrom:new Date(from+"T00:00:00.000Z"),effectiveTo:to?new Date(to+"T23:59:59.999Z"):null,employeeRate:pension+0.75,employerRate:pension+0.75+2,minimumWage,maximumWage:45000,housingIncluded:true,newSystemCutoff:new Date("2024-07-03T00:00:00Z")}));
}
export function saudiCalendarDay(date:Date) {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 return Date.UTC(Number(parts.find(p=>p.type==="year")?.value),Number(parts.find(p=>p.type==="month")?.value)-1,Number(parts.find(p=>p.type==="day")?.value));
}
export type PayrollLeave = { startDate:Date;endDate:Date;days:number;leaveType:{code:string;isPaid:boolean} };
/** Article 117: 30 full, 60 at 75%, 30 unpaid from first sick leave
 * in the entitlement year. Full-day records only; disputed overlaps or
 * non-calendar day quantities require HR reconciliation, not guessed deductions. */
export function calculateLeavePayroll(periodStart:Date,periodEnd:Date,leaves:PayrollLeave[],monthlyWage:number) {
 if(!Number.isFinite(monthlyWage)||monthlyWage<0)throw Error("أجر الإجازة غير صالح");
 const day=86400000,start=saudiCalendarDay(periodStart),end=saudiCalendarDay(periodEnd);
 const occupied=new Map<number,"PAID"|"SICK"|"UNPAID">();
 for(const leave of leaves){
   const first=saudiCalendarDay(leave.startDate),last=saudiCalendarDay(leave.endDate);
   const kind=leave.leaveType.code.toUpperCase().startsWith("SICK")?"SICK":leave.leaveType.isPaid?"PAID":"UNPAID";
   if(last<first||last-first>day*3660)throw Error("فترة إجازة غير صالحة");
   if(kind!=="PAID" && Math.abs(leave.days-((last-first)/day+1))>0.001)throw Error("راجع أيام الإجازة المرضية أو غير المدفوعة قبل احتساب الراتب");
   for(let t=first;t<=Math.min(last,end);t+=day){
     if(kind!=="SICK"&&t<start)continue;
     const prior=occupied.get(t);
     if(prior&&prior!==kind){
       if((prior==="SICK"&&kind==="PAID")||(prior==="PAID"&&kind==="SICK")){occupied.set(t,"SICK");continue;}
       throw Error("تداخل إجازات مدفوعة وغير مدفوعة؛ يلزم مراجعة الموارد البشرية");
     }
     occupied.set(t,kind);
   }
 }
 let sickYearEnd=0,used=0,unpaidDays=0,sickQuarterDays=0,sickUnpaidDays=0;
 for(const [t,kind] of [...occupied.entries()].sort((a,b)=>a[0]-b[0])){
   if(kind==="SICK"){
     if(!sickYearEnd||t>=sickYearEnd){const d=new Date(t);d.setUTCFullYear(d.getUTCFullYear()+1);sickYearEnd=d.getTime();used=0;}
     used++;
     if(t>=start){if(used>120)throw Error("الإجازة المرضية تتجاوز 120 يوماً؛ يلزم تحديد الإجراء النظامي");if(used>90)sickUnpaidDays++;else if(used>30)sickQuarterDays++;}
   }else if(kind==="UNPAID"&&t>=start)unpaidDays++;
 }
 const equivalentDays=unpaidDays+sickUnpaidDays+sickQuarterDays*0.25;
 if(equivalentDays>30)throw Error("خصم الإجازات يتجاوز أجر شهر؛ يلزم مراجعة الفترة");
 return {unpaidDays,sickQuarterDays,sickUnpaidDays,deduction:money(monthlyWage/30*equivalentDays),coveredDays:[...occupied.keys()].filter(t=>t>=start)};
}
