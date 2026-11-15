import type { Bucket, Field, Profile } from './types';

export const PROFILES: Profile[] = [
  { model: 'approval.request', label: 'الموافقات والطلبات العامة', owner: 'request_owner_id', ownerKind: 'user', state: 'request_status', reference: 'name', submit: 'action_confirm', writable: true },
  { model: 'hr.leave', label: 'الإجازات', owner: 'employee_id', ownerKind: 'employee', state: 'state', reference: 'name', submit: 'action_confirm', writable: true },
  { model: 'hr.expense', label: 'المصروفات', owner: 'employee_id', ownerKind: 'employee', state: 'state', reference: 'name', writable: false },
  { model: 'asset.account.request', label: 'طلبات العهد العينية', owner: 'employee_id', ownerKind: 'employee', state: 'state', reference: 'name', writable: false },
  { model: 'hr.loan', label: 'السلف والقروض', owner: 'employee_id', ownerKind: 'employee', state: 'state', reference: 'name', writable: false },
  { model: 'hr.overtime', label: 'العمل الإضافي', owner: 'employee_id', ownerKind: 'employee', state: 'state', reference: 'name', writable: false },
];
export const BUCKET_LABELS: Record<Bucket, string> = { DRAFT: 'مسودة', PENDING: 'قيد المراجعة', APPROVED: 'معتمد', COMPLETED: 'مكتمل', REJECTED: 'مرفوض', CANCELLED: 'ملغى', UNKNOWN: 'تحتاج مطابقة الحالة' };
export function bucketFor(model: string, state: unknown): Bucket {
  const value = String(state ?? '').toLowerCase();
  if (model === 'approval.request') return ({ new: 'DRAFT', pending: 'PENDING', approved: 'APPROVED', refused: 'REJECTED', cancel: 'CANCELLED' } as Record<string, Bucket>)[value] ?? 'UNKNOWN';
  if (model === 'hr.leave') return ({ draft: 'DRAFT', confirm: 'PENDING', validate1: 'PENDING', validate: 'APPROVED', refuse: 'REJECTED', cancel: 'CANCELLED' } as Record<string, Bucket>)[value] ?? 'UNKNOWN';
  return ({ draft: 'DRAFT', new: 'DRAFT', pending: 'PENDING', confirm: 'PENDING', submitted: 'PENDING', submit: 'PENDING', approve: 'APPROVED', approved: 'APPROVED', done: 'COMPLETED', paid: 'COMPLETED', refused: 'REJECTED', refuse: 'REJECTED', rejected: 'REJECTED', cancel: 'CANCELLED', cancelled: 'CANCELLED' } as Record<string, Bucket>)[value] ?? 'UNKNOWN';
}
export function profileFor(model: string): Profile {
  const known = PROFILES.find(item => item.model === model);
  if (known) return known;
  if (!/^[a-z][a-z0-9_.]{2,100}$/.test(model) || !/request|approval|overtime|loan|leave|expense/.test(model)) throw new Error('نموذج طلبات غير مدعوم');
  // Custom applications are read-only until their business actions are verified.
  return { model, label: model, owner: 'employee_id', ownerKind: 'employee', state: 'state', reference: 'name', writable: false };
}
export const positiveId = (value: unknown) => { const id = Array.isArray(value) ? Number(value[0]) : Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; };
export function scalarText(value: unknown): string {
  if (Array.isArray(value) && value.length === 2) return String(value[1] ?? '');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : typeof value === 'boolean' && value ? 'نعم' : '';
}
const excluded = new Set(['id', 'create_uid', 'write_uid', 'create_date', 'write_date', 'company_id', 'state', 'request_status', 'active', 'user_id', 'message_ids', 'activity_ids', 'approver_ids', 'department_id', 'manager_id', 'approver_id']);
export function formFields(fields: Record<string, Field>, profile: Profile) {
  const usual = new Set(['name', 'category_id', 'reason', 'description', 'amount', 'date', 'date_start', 'date_end', 'request_date_from', 'request_date_to', 'holiday_status_id', 'location', 'quantity', 'partner_id', 'reference']);
  return Object.keys(fields).filter(name => !excluded.has(name) && name !== profile.owner && !fields[name].readonly && (fields[name].required || usual.has(name)) && ['char', 'text', 'html', 'float', 'monetary', 'integer', 'boolean', 'date', 'datetime', 'selection', 'many2one'].includes(fields[name].type));
}
export function validateValues(input: unknown, fields: Record<string, Field>, allowed: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('حقول الطلب غير صالحة');
  const values: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.includes(key)) throw new Error('توجد حقول غير مسموح إرسالها');
    if (raw === '' || raw == null) continue;
    const field = fields[key];
    if (field.type === 'boolean') { if (typeof raw !== 'boolean') throw new Error('قيمة غير صالحة'); values[key] = raw; }
    else if (['integer', 'many2one', 'float', 'monetary'].includes(field.type)) {
      const n = Number(raw); if (!Number.isFinite(n) || Math.abs(n) > 1e12 || (['integer', 'many2one'].includes(field.type) && !Number.isSafeInteger(n)) || (field.type === 'many2one' && n <= 0)) throw new Error(`تحقق من ${field.string ?? key}`); values[key] = n;
    } else {
      if (typeof raw !== 'string' || raw.length > 8000) throw new Error('قيمة نصية غير صالحة');
      if (field.type === 'selection' && !field.selection?.some(([value]) => value === raw)) throw new Error('خيار غير متاح في أودو');
      if (field.type === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw) throw new Error('تاريخ غير صالح');
      }
      if (field.type === 'datetime') {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw))) throw new Error('أرسل الوقت مع منطقته الزمنية');
        values[key] = new Date(raw).toISOString().slice(0, 19).replace('T', ' ');
        continue;
      }
      values[key] = raw;
    }
  }
  return values;
}
export function appendEvent(events: { at: string; label: string; state?: string }[], label: string, state?: string) {
  return [...events, { at: new Date().toISOString(), label, ...(state ? { state } : {}) }].slice(-30);
}
export function submissionFingerprint(employeeId: string, model: string, values: Record<string, unknown>) {
  return JSON.stringify([employeeId, model, Object.keys(values).sort().map(key => [key, values[key]])]);
}
// Employee-facing fields are explicit. Custom/internal source fields are shown
// to authorized HR configuration roles, not exposed through the service account.
export const PUBLIC_REQUEST_FIELDS = new Set(['name','description','reason','amount','total_amount','date','date_start','date_end','request_date_from','request_date_to','holiday_status_id','category_id','currency_id','number_of_days','quantity','reference','location','partner_id','payment_method_id','payment_method','company_id','create_date','write_date']);
export function displayValue(field: Field | undefined, value: unknown) {
  if (field?.type === 'datetime' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return new Date(value.replace(' ','T')+'Z').toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'});
  if (field?.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value+'T00:00:00+03:00').toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh'});
  if (field?.type === 'selection') return field.selection?.find(([key])=>key===value)?.[1] ?? scalarText(value);
  return scalarText(value);
}
