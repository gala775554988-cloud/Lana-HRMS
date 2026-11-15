import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type { OdooClient } from '../client';
import type { Field } from './types';
export function isDefinitiveRejection(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; status?: number; details?: { code?: number; data?: { name?: string } } };
  if (value.status && value.status !== 401) return false;
  if (value.code === 'ODOO_AUTHENTICATION_ERROR') return true;
  return value.code === 'ODOO_RPC_REQUEST_ERROR' && value.details?.code === 200 && /^odoo\.exceptions\.(ValidationError|UserError|AccessError|MissingError)$/.test(value.details.data?.name ?? '');
}
export type RequestDocument = { name: string; mime: string; data?: string; hash: string; size: number; remoteId?: number; uncertain?: boolean };
export function validateDocuments(input: unknown): RequestDocument[] {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > 5) throw new Error('يمكن إرفاق خمسة مستندات بحد أقصى');
  let total = 0;
  return input.map(value => {
    if (!value || typeof value !== 'object' || typeof value.name !== 'string' || value.name.length > 150 || !value.name.trim() || typeof value.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data) || value.data.length > 2000000) throw new Error('ملف مرفق غير صالح');
    const bytes = Buffer.from(value.data, 'base64');
    const mime = bytes.subarray(0,5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
    if (!mime || bytes.length > 1500000 || bytes.length < 8) throw new Error('المرفقات المقبولة PDF وPNG وJPEG، حتى ١.٥ ميجابايت للملف');
    total += bytes.length; if (total > 2500000) throw new Error('إجمالي حجم المرفقات يجب ألا يتجاوز ٢.٥ ميجابايت');
    return { name: value.name.replace(/[\\/\x00-\x1f]/g, '_'), data: bytes.toString('base64'), mime, hash: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
  });
}
export const documentField = (fields: Record<string, Field>, writable = true) => ['document_ids','attachment_ids','supported_attachment_ids'].find(key => fields[key]?.relation === 'ir.attachment' && fields[key].type === 'many2many' && (!writable || !fields[key].readonly));
export function documentFingerprint(documents: RequestDocument[]) {
  return documents.map(({ name,hash }) => `${name}:${hash}`).sort().join('|');
}
export async function attachDocuments(client: OdooClient, model: string, remoteId: number, reference: string, documents: RequestDocument[], fields: Record<string, Field>, persist: (documents: RequestDocument[]) => Promise<void>) {
  const result = documents.map(item => ({ ...item }));
  for (const file of result) {
    if (file.remoteId) continue;
    const name = `${file.name} [${reference}-${file.hash.slice(0,16)}]`;
    const existing = await client.search_read('ir.attachment', [['res_model','=',model],['res_id','=',remoteId],['name','=',name]], ['id','checksum'], {limit:2});
    if (existing.length > 1) throw new Error('توجد مرفقات مكررة تحمل المرجع نفسه؛ يلزم التحقق');
    if (existing[0]?.id) {
      if (!file.data || existing[0].checksum !== createHash('sha1').update(Buffer.from(file.data,'base64')).digest('hex')) throw new Error('لا يطابق محتوى المرفق مرجعه المحفوظ؛ يلزم فحصه في أودو');
      file.remoteId = Number(existing[0].id);
    }
    else {
      if (file.uncertain) throw new Error('تأكيد أحد المرفقات غير محسوم. افحصه في أودو قبل إعادة الرفع');
      if (!file.data) throw new Error('بيانات المرفق غير متاحة');
      // A lost upload acknowledgement must not cause another upload blindly.
      file.uncertain = true; await persist(result);
      try { file.remoteId = await client.create('ir.attachment', { name, type:'binary', datas:file.data, mimetype:file.mime, res_model:model, res_id:remoteId }); }
      catch(error) { if (isDefinitiveRejection(error)) { file.uncertain = false; await persist(result); } throw error; }
    }
    file.uncertain = false; await persist(result);
  }
  const field = documentField(fields);
  if (field && result.length) await client.write(model, [remoteId], { [field]: result.map(file => [4,file.remoteId]) });
  return result;
}
