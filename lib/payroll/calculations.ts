export function money(value: number) {
  if (!Number.isFinite(value)) throw new Error("قيمة مالية غير صالحة");
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export type GosiPolicyInput = { id: string; cohort: string; effectiveFrom: Date; effectiveTo?: Date | null; employeeRate: number; employerRate: number; minimumWage: number; maximumWage: number; housingIncluded: boolean };
export function calculateGosi(input: { saudi: boolean; active: boolean; cohort: string; asOf: Date; basic: number; housing: number; policies: GosiPolicyInput[] }) {
  if (!input.saudi || !input.active) return { applicable: false, subjectWage: 0, employeeRate: null, employerRate: null, employeeAmount: 0, employerAmount: 0, policyId: null };
  if (![input.basic, input.housing].every(value => Number.isFinite(value) && value >= 0)) throw new Error("أجر التأمينات غير صالح");
  const candidates = input.policies.filter(policy => policy.cohort === input.cohort && policy.effectiveFrom <= input.asOf && (!policy.effectiveTo || policy.effectiveTo >= input.asOf));
  if (candidates.length !== 1) throw new Error("يجب تحديد سياسة تأمينات واحدة سارية لشريحة الموظف");
  const policy = candidates[0];
  if (![policy.employeeRate, policy.employerRate, policy.minimumWage, policy.maximumWage].every(Number.isFinite) || policy.employeeRate < 0 || policy.employerRate < 0 || policy.employeeRate > 100 || policy.employerRate > 100 || policy.minimumWage < 0 || policy.maximumWage < policy.minimumWage) throw new Error("سياسة التأمينات غير صالحة");
  const subjectWage = money(Math.min(policy.maximumWage, Math.max(policy.minimumWage, input.basic + (policy.housingIncluded ? input.housing : 0))));
  return { applicable: true, subjectWage, employeeRate: policy.employeeRate, employerRate: policy.employerRate, employeeAmount: money(subjectWage * policy.employeeRate / 100), employerAmount: money(subjectWage * policy.employerRate / 100), policyId: policy.id };
}
export function resolveGosiCohort(explicit: string | null, firstCoverageDate: Date | null, newSystemCutoff: Date | null) {
  if (explicit) return explicit;
  if (!firstCoverageDate || !newSystemCutoff) throw new Error("حدد شريحة التأمينات أو تاريخ أول اشتراك وتاريخ سريان النظام الجديد");
  return firstCoverageDate >= newSystemCutoff ? "NEW" : "LEGACY";
}
export function calculateEosb(input: { startDate: Date; endDate: Date; monthlyWage: number; reason: "RESIGNATION" | "NON_RENEWAL" | "TERMINATION"; excludedDays?: number; article80?: boolean; fullEntitlementException?: boolean }) {
  if (!Number.isFinite(input.startDate.getTime()) || !Number.isFinite(input.endDate.getTime()) || input.endDate < input.startDate || !Number.isFinite(input.monthlyWage) || input.monthlyWage < 0 || !["RESIGNATION", "NON_RENEWAL", "TERMINATION"].includes(input.reason)) throw new Error("بيانات التصفية غير صالحة");
  const excluded = input.excludedDays ?? 0;
  if (!Number.isSafeInteger(excluded) || excluded < 0) throw new Error("أيام الاستبعاد غير صالحة");
  const days = Math.max(0, Math.floor((input.endDate.getTime() - input.startDate.getTime()) / 86400000) - excluded);
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
  for (const row of rows) if (!validSaudiIban(row.iban) || !Number.isFinite(row.net) || row.net <= 0 || row.currency !== "SAR" || /^[=+@\-\t\r\n]/.test(row.employeeNumber)) throw new Error(`بيانات التحويل غير صالحة للموظف ${row.employeeNumber}`);
  return '\uFEFF' + ['employee_number,iban,currency,net_amount', ...rows.map(row => [escape(row.employeeNumber), escape(row.iban.replace(/\s/g, '').toUpperCase()), 'SAR', money(row.net).toFixed(2)].join(','))].join('\r\n');
}

export function calculateFinalSettlement(input: { eosb: number; unpaidSalary: number; leaveEncashment: number; otherEntitlements: number; deductions: number; outstandingLoans: number }) {
  if (!Object.values(input).every(value => Number.isFinite(value) && value >= 0)) throw new Error("مبالغ التصفية غير صالحة");
  const entitlements = money(input.eosb + input.unpaidSalary + input.leaveEncashment + input.otherEntitlements);
  const deductions = money(input.deductions + input.outstandingLoans);
  return { entitlements, deductions, netSettlement: money(entitlements - deductions), requiresHrReview: true };
}
