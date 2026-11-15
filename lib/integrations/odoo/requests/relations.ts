import type { OdooClient } from '../client';
import type { Configuration } from './types';
import { positiveId } from './profiles';
export async function permittedPartnerIds(client: OdooClient, employeeOdooId: number, config: Configuration, model: string, categoryId?: number, field = 'partner_id') {
  const metadata = await client.fieldsGet('hr.employee');
  const names = ['work_contact_id','address_home_id'].filter(name => metadata[name]);
  const [employee] = names.length ? await client.read('hr.employee',[employeeOdooId],names) : [];
  const own = names.map(name => positiveId(employee?.[name])).filter((id): id is number => !!id);
  const configured = config.mappings.filter(item=>item.model===model&&(!categoryId||item.categoryId===categoryId)).map(item=>positiveId(item.defaults[field])).filter((id):id is number=>!!id);
  return [...new Set([...own,...configured])];
}
