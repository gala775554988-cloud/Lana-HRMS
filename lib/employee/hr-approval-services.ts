// The nine HR approval services shown by the customer. Category IDs and
// approver order are discovered from Odoo; names never become identifiers.
export const HR_APPROVAL_SERVICES = [
  { code: 'PROJECT_PAYMENT', label: 'صرف المشاريع', description: 'معاملات ومستحقات وفواتير قسم المشاريع' },
  { code: 'LEAVE_SETTLEMENT', label: 'تصفية الإجازة', description: 'طلب مراجعة وصرف مستحقات الإجازة' },
  { code: 'EOS_SETTLEMENT', label: 'تصفية نهاية الخدمة', description: 'مراجعة مستحقات نهاية الخدمة قبل الصرف' },
  { code: 'CUSTODY_PAYMENT', label: 'صرف عهدة', description: 'طلب صرف عهدة مالية للموظف' },
  { code: 'BSF_PAYMENT', label: 'طلب صرف BSF', description: 'معاملة الصرف حسب تصنيف BSF في أودو' },
  { code: 'OVERTIME', label: 'صرف الأوفر تايم', description: 'مراجعة مستحقات العمل الإضافي' },
  { code: 'PAYROLL_PAYMENT', label: 'صرف الرواتب', description: 'طلب مراجعة مستحقات وفواتير الرواتب' },
  { code: 'LOAN', label: 'صرف سلفة', description: 'مراجعة السلفة وتسلسل اعتمادها' },
  { code: 'PETTY_CASH', label: 'صرف نثريات', description: 'طلبات نثريات قسم الموارد البشرية' },
] as const;
export const EXTRA_PAYMENT_TYPES = HR_APPROVAL_SERVICES.filter(item => !['OVERTIME', 'LOAN'].includes(item.code));
export const isHRPaymentType = (type: string) => EXTRA_PAYMENT_TYPES.some(item => item.code === type);
const categoryNames: Record<string, string[]> = {
 PROJECT_PAYMENT: ['طلب صرف الموارد البشرية - قسم المشاريع'],
 LEAVE_SETTLEMENT: ['طلب صرف الموارد البشرية - تصفية إجازة'],
 EOS_SETTLEMENT: ['طلب صرف الموارد البشرية - تصفية مستحقات نهاية الخدمة'],
 CUSTODY_PAYMENT: ['الموارد البشرية - صرف عهدة'],
 BSF_PAYMENT: ['الموارد البشرية طلب صرف BSF-','الموارد البشرية - طلب صرف BSF'],
 OVERTIME: ['الموارد البشرية - أوفر تايم'],
 PAYROLL_PAYMENT: ['طلب صرف الموارد البشرية - الرواتب'],
 LOAN: ['الموارد البشرية - صرف سلفة'],
 PETTY_CASH: ['صرف نثريات - قسم الموارد البشرية'],
};
const normalizedCategory = (value: string) => value.toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[\sـ_\-–—:]/g,'');
// Unique exact normalized names only; automatic setup verifies source fields
// and category requirements before enabling these mappings.
export function suggestHRCategoryMappings(categories: {id:number;label:string}[]) {
 return HR_APPROVAL_SERVICES.flatMap(service => {
  const names = categoryNames[service.code].map(normalizedCategory);
  const matches = categories.filter(category => names.includes(normalizedCategory(category.label)));
  return matches.length === 1 ? [{type:service.code,model:'approval.request',categoryId:matches[0].id,defaults:{}}] : [];
 });
}
