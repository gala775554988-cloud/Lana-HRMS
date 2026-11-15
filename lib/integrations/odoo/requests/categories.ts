import type { OdooClient } from '../client';
import type { Field } from './types';
import { positiveId, scalarText } from './profiles';
export type CategoryDetails = { id: number; label: string; companyId?: number; minimum?: number; sequenced: boolean | null; managerRule?: string; requiredFields: string[]; optionalFields: string[]; requiresDocuments: boolean; unsupported: string[]; approvers: { name: string; sequence?: number; required?: boolean }[] };
const flags: Record<string, string[]> = { has_date: ['date'], has_period: ['date_start', 'date_end'], has_amount: ['amount'], has_quantity: ['quantity'], has_location: ['location'], has_reference: ['reference'], has_partner: ['partner_id'], has_payment_method: ['payment_method_id'] };
export async function categoryDetails(client: OdooClient, id: number, requestFields: Record<string, Field>): Promise<CategoryDetails> {
  const metadata = await client.fieldsGet('approval.category') as unknown as Record<string, Field>;
  const columns = ['name', 'company_id', 'approval_minimum', 'approver_sequence', 'manager_approval', 'approver_ids', 'has_document', 'has_product', ...Object.keys(flags)].filter(name => metadata[name]);
  const [row] = await client.read('approval.category', [id], columns);
  if (!row) throw new Error('تصنيف الموافقة لم يعد متاحًا في أودو');
  const requiredFields: string[] = [], optionalFields: string[] = [], unsupported: string[] = [];
  for (const [flag, names] of Object.entries(flags)) {
    const mode = row[flag]; if (mode !== 'required' && mode !== 'optional') continue;
    for (const name of names) {
      if (!requestFields[name]) { if (mode === 'required') unsupported.push(metadata[flag]?.string ?? name); continue; }
      (mode === 'required' ? requiredFields : optionalFields).push(name);
    }
  }
  if (row.has_product === 'required') unsupported.push('بنود المنتجات: تتطلب نموذج البنود الأصلي في أودو');
  let approvers: CategoryDetails['approvers'] = [];
  if (Array.isArray(row.approver_ids) && row.approver_ids.length) {
    const lineModel = metadata.approver_ids?.relation;
    if (lineModel) {
      const lineFields = await client.fieldsGet(lineModel) as unknown as Record<string, Field>;
      if (lineFields.user_id?.relation === 'res.users') {
        const lines = await client.read(lineModel, row.approver_ids.map(Number), ['user_id', ...['sequence','required'].filter(name => lineFields[name])]);
        approvers = lines.map(line => ({ name: scalarText(line.user_id), ...(typeof line.sequence === 'number' ? {sequence:line.sequence} : {}), ...(typeof line.required === 'boolean' ? {required:line.required} : {}) }));
        if (row.approver_sequence === true) approvers.sort((a,b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      }
    }
  }
  return { id, label: scalarText(row.name), ...(positiveId(row.company_id) ? {companyId:positiveId(row.company_id)!} : {}), ...(typeof row.approval_minimum === 'number' ? { minimum: row.approval_minimum } : {}), sequenced: typeof row.approver_sequence === 'boolean' ? row.approver_sequence : null, managerRule: scalarText(row.manager_approval), requiredFields, optionalFields, requiresDocuments: row.has_document === 'required', unsupported, approvers };
}
export async function categoryCatalog(client: OdooClient) {
  const rows = await client.search_read('approval.category', [], ['id', 'name'], { limit: 500, order: 'id asc' });
  return rows.map(row => ({id:positiveId(row.id)!,label:scalarText(row.name)})).filter(row => row.id);
}
