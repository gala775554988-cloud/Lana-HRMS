import { permittedPartnerIds } from './relations';
import { HR_APPROVAL_SERVICES } from '@/lib/employee/hr-approval-services';
import { getRequestTypeConfig } from '@/lib/employee/request-form-config';
import { attachDocuments, documentField, documentFingerprint, validateDocuments, isDefinitiveRejection } from './documents';
import { categoryDetails } from './categories';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getPayrollOdooClient } from '@/lib/payroll/connection';
import { OdooClient } from '../client';
import type { OdooConfig } from '../types';
import { appendEvent, bucketFor, formFields, positiveId, profileFor, PROFILES, scalarText, validateValues, submissionFingerprint, displayValue, PUBLIC_REQUEST_FIELDS } from './profiles';
import { configuration, getLink, recordKey, remoteKey, saveLink } from './store';
import type { Configuration, Descriptor, Field, Profile, RequestLink } from './types';
import { CONFIG_KEY, RECORD_PREFIX } from './types';

export async function requestConnection(config: Configuration) {
  const { client: original } = await getPayrollOdooClient(config.connectionId);
  const raw = original.getConfig(false) as OdooConfig;
  const source = createHash('sha256').update(new URL(raw.url).origin + '/' + raw.database).digest('hex');
  if (config.source && source !== config.source) throw new Error('تغير اتصال أودو؛ أعد التحقق من مصدر الطلبات قبل المزامنة');
  const binding = await prisma.appSetting.findUnique({ where: { key: 'odoo.migration.employeeSource' } });
  if (!binding || binding.value !== source) throw new Error('يجب توثيق مصدر الموظفين ومطابقته مع اتصال الطلبات أولًا');
  const publicUrl = new URL(raw.url); publicUrl.username = ''; publicUrl.password = ''; publicUrl.search = ''; publicUrl.hash = '';
  return { client: new OdooClient({ ...raw, maxRetries: 0, timeoutMs: 15000 }), source, baseUrl: publicUrl.href.replace(/\/$/, '') };
}
export async function describeModel(client: OdooClient, model: string): Promise<Descriptor> {
  const profile = profileFor(model);
  const fields = await client.fieldsGet(model, [], ['string', 'type', 'required', 'readonly', 'relation', 'selection', 'help']) as unknown as Record<string, Field>;
  if (model === 'approval.request' && fields.category_id?.relation !== 'approval.category') throw new Error('علاقة تصنيف الموافقات غير متوافقة مع التطبيق الأصلي');
  if (model === 'hr.leave' && fields.holiday_status_id?.relation !== 'hr.leave.type') throw new Error('علاقة نوع الإجازة غير متوافقة مع المصدر');
  if (fields[profile.owner]?.relation !== (profile.ownerKind === 'employee' ? 'hr.employee' : 'res.users') || !fields[profile.state] || !fields[profile.reference] || !fields.write_date) throw new Error('حقول صاحب الطلب أو الحالة أو المرجع غير متوافقة مع النموذج');
  const allowed = formFields(fields, profile);
  const required = Object.keys(fields).filter(name => fields[name].required && !fields[name].readonly && name !== profile.owner);
  const defaults = await client.execute_kw<Record<string, unknown>>(model, 'default_get', [required]).catch(() => ({} as Record<string, unknown>));
  const supportedRelations = new Set(['approval.category','hr.leave.type','res.currency','uom.uom','res.partner','res.company']);
  const missing = required.filter(name => !allowed.includes(name) && (defaults[name] == null || defaults[name] === false || Array.isArray(defaults[name]) && !(defaults[name] as unknown[]).length) || fields[name].type === 'many2one' && !supportedRelations.has(fields[name].relation ?? ''));
  return { profile, fields, defaults, formFields: allowed, missing, canCreate: profile.writable && !fields[profile.reference].readonly && !missing.length };
}
export async function discoverModels(connectionId?: string) {
  const current = await configuration();
  const context = await requestConnection({ ...current, connectionId: connectionId || current.connectionId });
  const candidates = new Set(PROFILES.map(item => item.model));
  const discovered = await context.client.search_read('ir.model', ['|', '|', ['model', 'ilike', 'request'], ['model', 'ilike', 'approval'], ['model', 'ilike', 'loan']], ['model', 'name'], { limit: 100 }).catch(() => []);
  for (const row of discovered) if (typeof row.model === 'string' && !/line|report|wizard|template|setting|type|category/.test(row.model)) candidates.add(row.model);
  const models: Descriptor[] = [], unavailable: string[] = [];
  for (const model of [...candidates].slice(0, 20)) {
    try { models.push(await describeModel(context.client, model)); } catch { unavailable.push(model); }
  }
  return { models, unavailable, source: context.source };
}
export async function configureRequests(input: Configuration, actorId: string) {
  if (input.enabled && !input.models.length) throw new Error('اختر تطبيق طلبات واحدًا على الأقل');
  const context = await requestConnection(input);
  const prior = await configuration();
  if (prior.source && prior.source !== context.source) throw new Error('لا يمكن تبديل مصدر الطلبات المرتبطة دون مراجعة المطابقة');
  const descriptions = new Map<string, Descriptor>();
  for (const model of input.models) descriptions.set(model, await describeModel(context.client, model));
  const seen = new Set<string>();
  for (const mapping of input.mappings) {
    if (seen.has(`${mapping.type}:${mapping.leaveTypeId ?? ""}`)) throw new Error('يوجد ربط مكرر لنوع الطلب');
    seen.add(`${mapping.type}:${mapping.leaveTypeId ?? ""}`);
    const descriptor = descriptions.get(mapping.model);
    if (!descriptor?.canCreate) throw new Error('نموذج الإرسال غير مفعّل أو حقوله غير مكتملة');
    validateValues(mapping.defaults, descriptor.fields, descriptor.formFields);
    if (mapping.model === 'hr.leave' && (!mapping.leaveTypeId || !Number.isSafeInteger(Number(mapping.defaults.holiday_status_id)) || Number(mapping.defaults.holiday_status_id) <= 0)) throw new Error('طابق نوع إجازة لانا بمعرّف نوع الإجازة في أودو');
    if (mapping.model === 'approval.request' && !mapping.categoryId) throw new Error('حدد تصنيف أودو لهذا النوع من الطلبات');
  }
  const categoryIds = [...new Set(input.mappings.map(item => item.categoryId).filter((id): id is number => !!id))];
  if (categoryIds.length) {
    const found = await context.client.read('approval.category', categoryIds, ['id']);
    if (found.length !== categoryIds.length) throw new Error('تصنيف أودو المختار لم يعد متاحًا');
  }
  const nativeLeaves = input.mappings.filter(item => item.model === 'hr.leave');
  if (nativeLeaves.length) {
    const local = await prisma.leaveType.findMany({ where: { id: { in: nativeLeaves.map(item => item.leaveTypeId!) }, isActive: true }, select: { id: true } });
    if (new Set(local.map(item => item.id)).size !== new Set(nativeLeaves.map(item => item.leaveTypeId)).size) throw new Error('نوع إجازة لانا غير متاح');
    const ids = [...new Set(nativeLeaves.map(item => Number(item.defaults.holiday_status_id)))];
    if ((await context.client.read('hr.leave.type', ids, ['id'])).length !== ids.length) throw new Error('نوع إجازة أودو غير متاح');
  }
  const config = { ...input, source: context.source };
  await prisma.$transaction(async tx => {
    await tx.appSetting.upsert({ where: { key: CONFIG_KEY }, create: { key: CONFIG_KEY, value: JSON.parse(JSON.stringify(config)) }, update: { value: JSON.parse(JSON.stringify(config)) } });
    await tx.auditLog.create({ data: { actorUserId: actorId, action: 'odoo-requests:configure', entity: 'AppSetting', entityId: CONFIG_KEY, metadata: { enabled: config.enabled, models: config.models, source: config.source } } });
  });
  return config;
}
function assertCategory(config: Configuration, model: string, values: Record<string, unknown>) {
  if (model === 'approval.request' && !config.mappings.some(item => item.model === model && item.categoryId === Number(values.category_id))) throw new Error('تصنيف الطلب غير مفعّل ضمن خدمات الموارد البشرية');
  if (model === 'hr.leave' && !config.mappings.some(item => item.model === model && Number(item.defaults.holiday_status_id) === Number(values.holiday_status_id))) throw new Error('نوع الإجازة غير مفعّل ضمن ربط الموارد البشرية');
}
async function remoteOwner(client: OdooClient, profile: Profile, employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { odooId: true } });
  if (!employee?.odooId) throw new Error('الموظف غير مربوط بمعرّف أودو موثّق');
  const [remote] = await client.read('hr.employee', [employee.odooId], ['id', 'user_id', 'company_id']);
  if (!remote) throw new Error('تعذر التحقق من موظف أودو');
  const owner = profile.ownerKind === 'employee' ? employee.odooId : positiveId(remote.user_id);
  if (profile.ownerKind === 'user' && owner) {
    const matches = await client.search_read('hr.employee', [['user_id','=',owner]], ['id'], { limit:2,context:{active_test:false} });
    if (matches.length !== 1 || Number(matches[0].id) !== employee.odooId) throw new Error('حساب أودو غير مطابق لموظف واحد؛ راجع الحسابات المكررة قبل إرسال الطلب');
  }
  if (!owner) throw new Error('الموظف غير مربوط بمستخدم أودو لاستقبال طلب الموافقة');
  return { owner, companyId: positiveId(remote.company_id) };
}
const readColumns = (descriptor: Descriptor) => Array.from(new Set(['id', descriptor.profile.owner, descriptor.profile.state, descriptor.profile.reference, 'write_date', ...Object.keys(descriptor.fields).filter(name => !['create_uid','write_uid','user_id'].includes(name) && !/message_|activity_|access_token|access_url|access_warning|has_message|password|secret|private_key/.test(name) && ['char','text','html','integer','float','monetary','date','datetime','selection','boolean','many2one'].includes(descriptor.fields[name].type)).slice(0,60), ...['create_date', 'reason', 'description', 'amount', 'total_amount', 'date', 'date_start', 'date_end', 'request_date_from', 'request_date_to', 'number_of_days', 'category_id', 'holiday_status_id', 'currency_id', 'approver_ids', 'document_ids', 'attachment_ids', 'supported_attachment_ids'].filter(name => descriptor.fields[name]) ]));
async function applyRemote(link: RequestLink, row: Record<string, unknown>, descriptor: Descriptor, client: OdooClient, baseUrl: string, prefetchedApprovers?: RequestLink["approvers"], completeDelivery = false) {
  const remoteId = positiveId(row.id);
  if (!remoteId) throw new Error('معرّف أودو غير صالح');
  const state = scalarText(row[descriptor.profile.state]);
  const bucket = bucketFor(link.model, state);
  const events = link.remoteState !== state ? appendEvent(link.events, `تحديث حالة أودو: ${descriptor.fields[descriptor.profile.state].selection?.find(([value]) => value === state)?.[1] ?? state}`, state) : link.events;
  let approvers = prefetchedApprovers ?? [];
  if (prefetchedApprovers === undefined && link.model === 'approval.request' && Array.isArray(row.approver_ids) && row.approver_ids.length) {
    const lines = await client.read('approval.approver', row.approver_ids.map(Number), ['user_id', 'status', 'write_date']).catch(() => null);
    if (lines) approvers = lines.map(item => ({ name: scalarText(item.user_id), state: scalarText(item.status), writeDate: scalarText(item.write_date) }));
  }
  const version = [scalarText(row.write_date), ...approvers.map(item => item.writeDate ?? '')].sort().at(-1) ?? '';
  if (prefetchedApprovers === undefined && link.model === 'approval.request') {
    const [fresh] = await client.read(link.model, [remoteId], [descriptor.profile.state, 'write_date']);
    if (!fresh || scalarText(fresh[descriptor.profile.state]) !== state || scalarText(fresh.write_date) !== scalarText(row.write_date)) throw new Error('تغير قرار أودو أثناء القراءة؛ أعد الفحص');
  }
  const remoteDocuments = documentField(descriptor.fields, false);
  const documentIds = remoteDocuments && Array.isArray(row[remoteDocuments]) ? (row[remoteDocuments] as number[]) : [];
  const documents = documentIds.length ? documentIds.map(id => ({id,name:`مرفق أودو #${id}`})) : link.documents;
  const next: RequestLink = { ...link, documents, title: scalarText(row[descriptor.profile.reference]).replace(/\s*\[LRQ-[A-Z0-9-]+\]/, '') || link.title, remoteId, remoteReference: scalarText(row[descriptor.profile.reference]) || String(remoteId), remoteState: state, remoteWriteDate: version, bucket, syncState: 'SYNCED', error: undefined, leaseUntil: undefined, lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), remoteUrl: `${baseUrl.replace(/\/+$/, '')}/web#id=${remoteId}&model=${encodeURIComponent(link.model)}&view_type=form`, fields: readColumns(descriptor).filter(name => !['id', 'approver_ids', descriptor.profile.state, descriptor.profile.owner].includes(name)).map(name => ({ name, label: descriptor.fields[name]?.string ?? name, value: displayValue(descriptor.fields[name], row[name]) })).filter(item => item.value), approvers, events };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const current = await tx.appSetting.findUnique({ where: { key: recordKey(next.id) } });
        const prior = current?.value as unknown as RequestLink | undefined;
        if (prior?.remoteWriteDate && next.remoteWriteDate && prior.remoteWriteDate > next.remoteWriteDate) return prior;
        const merged = { ...prior, ...next, values: prior?.values ?? next.values };
        const sending = prior?.syncState === 'SENDING' && Date.parse(prior.leaseUntil ?? '') > Date.now();
        const awaitingDelivery = prior?.origin === 'LANA' && !['PENDING','APPROVED','COMPLETED','REJECTED','CANCELLED'].includes(bucket) && prior.syncState !== 'SYNCED';
        if (!completeDelivery && prior && (sending || awaitingDelivery)) { merged.syncState = prior.syncState; merged.leaseUntil = prior.leaseUntil; merged.error = prior.error; merged.attachments = prior.attachments; }
        if (!sending && ['PENDING','APPROVED','COMPLETED','REJECTED','CANCELLED'].includes(bucket)) merged.attachments = merged.attachments?.map(({data:_data,...file}) => file);
        if (prior) merged.events = prior.remoteState !== state ? appendEvent(prior.events, `تحديث حالة أودو: ${descriptor.fields[descriptor.profile.state].selection?.find(([value]) => value === state)?.[1] ?? state}`, state) : prior.events;
        await tx.appSetting.upsert({ where: { key: recordKey(next.id) }, create: { key: recordKey(next.id), value: JSON.parse(JSON.stringify(merged)), isSecret: true }, update: { value: JSON.parse(JSON.stringify(merged)), isSecret: true } });
        if (next.workflowId) {
          const status = ['APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(bucket) ? bucket : 'PENDING';
          const updated = await tx.workflowInstance.updateMany({ where: { id: next.workflowId, employeeId: next.employeeId!, status: { not: status } }, data: { status } });
          if (updated.count) await tx.auditLog.create({ data: { action: 'odoo-request:status', entity: 'workflowInstance', entityId: next.workflowId, metadata: { remoteId, model: next.model, remoteState: state, status } } });
        }
        return merged;
      }, { isolationLevel: 'Serializable' });
    } catch (error) { if (attempt === 2 || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2034') throw error; }
  }
  throw new Error('تغير الطلب أثناء المزامنة؛ أعد الفحص');
}
export async function dispatchRequest(id: string) {
  const item = await getLink(id);
  if (!item || item.link.origin !== 'LANA') return item?.link ?? null;
  if (item.link.syncState === 'SENDING' && Date.parse(item.link.leaseUntil ?? '') > Date.now()) return item.link;
  const link = { ...item.link, syncState: 'SENDING' as const, attempts: item.link.attempts + 1, leaseUntil: new Date(Date.now() + 330000).toISOString() };
  const claimed = await prisma.appSetting.updateMany({ where: { key: recordKey(id), updatedAt: item.setting.updatedAt, AND: [{ value: { path: ['attempts'], equals: item.link.attempts } }] }, data: { value: JSON.parse(JSON.stringify(link)) } });
  if (claimed.count !== 1) return item.link;
  let creationStarted = false;
  try {
    const config = await configuration();
    if (!config.enabled || config.source !== link.source || !config.models.includes(link.model)) throw new Error('الربط غير مفعّل لهذا المصدر أو النموذج');
    const { client, baseUrl } = await requestConnection(config);
    const descriptor = await describeModel(client, link.model);
    if (!descriptor.canCreate) throw new Error('نموذج الإرسال يحتاج مراجعة حقوله الإلزامية');
    const identity = await remoteOwner(client, descriptor.profile, link.employeeId!);
    const owner = identity.owner;
    assertCategory(config, link.model, link.values ?? {});
    if (!link.privilegedRelations) for (const [field, value] of Object.entries(link.values ?? {})) {
      const relation = descriptor.fields[field]?.relation;
      if (!value || !relation) continue;
      if (relation === 'res.partner') {
        const employee = await prisma.employee.findUniqueOrThrow({ where: { id: link.employeeId! }, select: { odooId: true } });
        const partners = await permittedPartnerIds(client, employee.odooId!, config, link.model, Number(link.values?.category_id), field);
        if (!partners.includes(Number(value))) throw new Error('الجهة المستفيدة غير مفعّلة لهذا الموظف أو التصنيف؛ راجع الموارد البشرية');
      }
    }

    let remoteId = link.remoteId;
    if (!remoteId) {
      const matches = await client.search_read(link.model, [[descriptor.profile.reference, 'ilike', link.reference], [descriptor.profile.owner, '=', owner]], ['id', descriptor.profile.reference], { limit: 2, context: { active_test: false } });
      if (matches.length > 1) throw new Error('وجد أكثر من سجل يحمل المرجع نفسه؛ يلزم مراجعة المطابقة');
      if (matches[0]) remoteId = positiveId(matches[0].id) ?? undefined;
      if (!remoteId && ['UNCERTAIN', 'SENDING'].includes(item.link.syncState)) {
        await saveLink({ ...link, syncState: 'UNCERTAIN', leaseUntil: undefined, error: 'لم يُعثر على السجل بعد انقطاع الرد. لا يُعاد إنشاؤه تلقائيًا منعًا للتكرار.', updatedAt: new Date().toISOString() });
        return (await getLink(id))!.link;
      }
      if (!remoteId) {
        const normalized = Object.fromEntries(Object.entries(link.values ?? {}).map(([key,value]) => [key, descriptor.fields[key]?.type === 'datetime' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value]));
        const values = validateValues(normalized, descriptor.fields, descriptor.formFields);
        values[descriptor.profile.reference] = `${link.title.slice(0, 150)} [${link.reference}]`;
        values[descriptor.profile.owner] = owner;
        if (descriptor.fields.company_id && !descriptor.fields.company_id.readonly) {
          if (!identity.companyId) throw new Error('تعذر تثبيت شركة الموظف في أودو');
          values.company_id = identity.companyId;
        }
        for (const name of descriptor.formFields) if (descriptor.fields[name].required && values[name] == null && descriptor.defaults[name] == null) throw new Error(`حقل أودو مطلوب: ${descriptor.fields[name].string ?? name}`);
        if (link.model === 'approval.request') {
          const category = await categoryDetails(client, Number(values.category_id), descriptor.fields);
          if (category.companyId && category.companyId !== identity.companyId) throw new Error('تصنيف الموافقة يتبع شركة مختلفة عن شركة الموظف');
          if (category.unsupported.length) throw new Error(`حقول التصنيف تحتاج نموذج أودو الأصلي: ${category.unsupported.join('، ')}`);
          for (const key of category.requiredFields) if (values[key] == null || values[key] === '') throw new Error(`حقل مطلوب لهذا التصنيف: ${descriptor.fields[key]?.string ?? key}`);
          if (category.requiresDocuments && !link.attachments?.length) throw new Error('هذا التصنيف يتطلب مرفقات موثقة قبل الإرسال');
          if (category.requiresDocuments && !documentField(descriptor.fields)) throw new Error('ربط مستندات هذا التصنيف يحتاج نموذج أودو الأصلي');
        }
        creationStarted = true;
        remoteId = positiveId(await client.create(link.model, values)) ?? undefined;
        if (!remoteId) throw new Error('لم يؤكد أودو معرّف الطلب');
        link.remoteId = remoteId;
        await saveLink(link); // Persist acknowledgement before invoking a business action.
      }
    }
    let [before] = await client.read(link.model, [remoteId], readColumns(descriptor));
    if (!before || positiveId(before[descriptor.profile.owner]) !== owner) throw new Error('لا تطابق هوية صاحب الطلب في المصدر');
    if (link.attachments?.length) {
      link.attachments = await attachDocuments(client, link.model, remoteId, link.reference, link.attachments, descriptor.fields, async attachments => { link.attachments = attachments; await saveLink(link); });
      [before] = await client.read(link.model, [remoteId], readColumns(descriptor));
      if (!before || positiveId(before[descriptor.profile.owner]) !== owner) throw new Error("تغير صاحب الطلب أثناء رفع المستندات");
    }
    if (link.model === 'approval.request' && bucketFor(link.model, before[descriptor.profile.state]) === 'DRAFT') {
      assertCategory(config, link.model, {category_id:positiveId(before.category_id)});
      const category = await categoryDetails(client, positiveId(before.category_id)!, descriptor.fields);
      if (category.unsupported.length) throw new Error('يتطلب هذا التصنيف نموذج بنود أودو الأصلي');
      for (const field of category.requiredFields) if (before[field] == null || before[field] === false || before[field] === '') throw new Error(`حقل أودو مطلوب: ${descriptor.fields[field]?.string ?? field}`);
      const docs = documentField(descriptor.fields,false);
      if (category.requiresDocuments && (!docs || !Array.isArray(before[docs]) || !(before[docs] as unknown[]).length)) throw new Error('لم يؤكد أودو ربط المستندات المطلوبة بالطلب');
    }
    if (bucketFor(link.model, before[descriptor.profile.state]) === 'DRAFT' && descriptor.profile.submit) await client.execute_kw(link.model, descriptor.profile.submit, [[remoteId]]);
    const [row] = await client.read(link.model, [remoteId], readColumns(descriptor));
    if (!row) throw new Error('لم تصل نتيجة الطلب من أودو');
    if (descriptor.profile.submit && bucketFor(link.model, row[descriptor.profile.state]) === 'DRAFT') throw new Error('لا يزال الطلب مسودة في أودو؛ راجع متطلبات بدء الموافقة');
    return await applyRemote({ ...link, attachments: link.attachments?.map(({data: _data,...file}) => file), documents: link.attachments?.filter(file => file.remoteId).map(file => ({id:file.remoteId!,name:file.name})), events: appendEvent(link.events, 'وصل الطلب إلى أودو وتحققت حالته') }, row, descriptor, client, baseUrl, undefined, true);
  } catch (error) {
    const confirmedFailure = isDefinitiveRejection(error);
    const ambiguous = creationStarted && !link.remoteId && !confirmedFailure;
    const pendingDocument = link.attachments?.some(file => file.uncertain && !file.remoteId);
    const message = pendingDocument ? 'تأكيد أحد المرفقات يحتاج مطابقة في أودو؛ لن يُرفع تلقائيًا مرة ثانية دون التحقق.' : !creationStarted && error instanceof Error && !('code' in error) ? error.message : ambiguous ? 'انقطع التأكيد من أودو؛ سيُفحص المرجع قبل أي محاولة أخرى.' : 'تعذر إكمال الطلب في أودو. راجع الحقول وصلاحيات اتصال الربط ثم أعد الفحص.';
    const next = { ...link, syncState: ambiguous ? 'UNCERTAIN' as const : 'ERROR' as const, error: message, leaseUntil: undefined, updatedAt: new Date().toISOString(), events: appendEvent(link.events, ambiguous ? 'تأكيد الإرسال يحتاج مطابقة' : 'تعثر الاتصال أو التحقق من حقول الطلب') };
    await saveLink(next);
    return next;
  }
}
export async function createRemoteRequest(input: { employeeId: string; actorId: string; model: string; values: unknown; attachments?: unknown; privilegedRelations?: boolean; idempotencyKey: string }) {
  const config = await configuration();
  if (!config.enabled || !config.models.includes(input.model)) throw new Error('الربط غير مفعّل لهذا النوع من الطلبات');
  const { client, source } = await requestConnection(config);
  const descriptor = await describeModel(client, input.model);
  if (!descriptor.canCreate) throw new Error('هذا النموذج متاح للمتابعة فقط حتى التحقق من إجراءات إرساله');
  const values = validateValues(input.values, descriptor.fields, input.privilegedRelations ? descriptor.formFields : descriptor.formFields.filter(name => PUBLIC_REQUEST_FIELDS.has(name)));
  assertCategory(config, input.model, values);
  const attachments = validateDocuments(input.attachments);
  const id = createHash('sha256').update(`${source}:${input.actorId}:${input.idempotencyKey}`).digest('hex');
  const existing = await getLink(id);
  const fingerprint = submissionFingerprint(input.employeeId, input.model, values) + documentFingerprint(attachments);
  if (existing) {
    if (submissionFingerprint(existing.link.employeeId!, existing.link.model, existing.link.values ?? {}) + documentFingerprint(existing.link.attachments ?? []) !== fingerprint) throw new Error('استُخدم مفتاح الإرسال لطلب مختلف');
    return existing.link.syncState === 'SYNCED' ? existing.link : dispatchRequest(id);
  }
  await remoteOwner(client, descriptor.profile, input.employeeId);
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { firstName: true, lastName: true, employeeNumber: true } });
  const now = new Date().toISOString();
  const link: RequestLink = { id, source, model: input.model, origin: 'LANA', privilegedRelations: !!input.privilegedRelations, reference: `LRQ-${randomUUID().toUpperCase()}`, employeeId: input.employeeId, employeeName: `${employee.firstName} ${employee.lastName}`, employeeNumber: employee.employeeNumber, createdBy: input.actorId, title: String(values.name ?? descriptor.profile.label), values, attachments, bucket: 'DRAFT', syncState: 'PENDING', attempts: 0, createdAt: now, updatedAt: now, events: [{ at: now, label: 'حُفظ الطلب في لانا وجُهز للإرسال إلى أودو' }] };
  try { await prisma.appSetting.create({ data: { key: recordKey(id), value: JSON.parse(JSON.stringify(link)), isSecret: true } }); }
  catch (error) { const winner = await getLink(id); if (!winner) throw error; if (submissionFingerprint(winner.link.employeeId!, winner.link.model, winner.link.values ?? {}) + documentFingerprint(winner.link.attachments ?? []) !== fingerprint) throw new Error('استُخدم مفتاح الإرسال لطلب مختلف'); }
  await prisma.auditLog.create({ data: { actorUserId: input.actorId, action: 'odoo-request:submit', entity: 'odooRequest', entityId: id, metadata: { model: input.model, employeeId: input.employeeId, reference: link.reference } } });
  return dispatchRequest(id);
}

// Durable, per-record pull with a source-specific checkpoint. Changes arriving
// during a page read fall into the next write_date window, never into a gap.
async function pullOdooRequests(target?: { model: string; id: number }, maxPages = 3) {
  const config = await configuration();
  if (!config.enabled) return { enabled: false, imported: 0, errors: [] as string[] };
  const { client, source, baseUrl } = await requestConnection(config);
  const result = { enabled: true, imported: 0, skipped: 0, errors: [] as string[] };
  for (const model of target ? [target.model] : config.models) {
    if (!config.models.includes(model)) throw new Error('نموذج غير مفعّل');
    try {
      const descriptor = await describeModel(client, model);
      const checkpointKey = `odoo.requests.cursor.${remoteKey(source, model, 0)}`;
      const prior = await prisma.appSetting.findUnique({ where: { key: checkpointKey } });
      const checkpoint = prior?.value as { since?: string; until?: string; lastId?: number; running?: boolean; failedIds?: number[] } | undefined;
      const until = checkpoint?.running ? checkpoint.until! : new Date().toISOString().slice(0, 19).replace('T', ' ');
      const since = checkpoint?.since ?? '1970-01-01 00:00:00';
      let lastId = checkpoint?.running ? checkpoint.lastId ?? 0 : 0;
      const retryIds = checkpoint?.failedIds ?? [];
      const failures = new Set<number>(retryIds);
      for (let page = 0; page < (target ? 1 : maxPages + (retryIds.length ? 1 : 0)); page++) {
        const retryPage = !target && page === 0 && retryIds.length > 0;
        const rows = retryPage ? await client.read(model, retryIds.slice(0, 500), readColumns(descriptor), { context: { active_test: false } }) : target ? await client.read(model, [target.id], readColumns(descriptor)) : await client.search_read(model, [['write_date', '>=', since], ['write_date', '<=', until], ['id', '>', lastId]], readColumns(descriptor), { limit: 500, order: 'id asc', context: { active_test: false } });
        // Resolve identities in bulk; never infer identity from a display name.
        const owners = [...new Set(rows.map(row => positiveId(row[descriptor.profile.owner])).filter((id): id is number => !!id))];
        const remoteEmployees = descriptor.profile.ownerKind === 'user' && owners.length ? await client.search_read('hr.employee', [['user_id', 'in', owners]], ['id', 'user_id'], { limit: 10000, context: { active_test: false } }) : [];
        if (remoteEmployees.length >= 10000) throw new Error('تعذر التأكد من جميع مطابقات المستخدمين');
        const ownerEmployees = new Map<number, number[]>();
        for (const employee of remoteEmployees) { const owner = positiveId(employee.user_id)!; ownerEmployees.set(owner, [...(ownerEmployees.get(owner) ?? []), Number(employee.id)]); }
        const remoteEmployeeIds = descriptor.profile.ownerKind === 'employee' ? owners : remoteEmployees.map(item => Number(item.id));
        const employees = remoteEmployeeIds.length ? await prisma.employee.findMany({ where: { odooId: { in: remoteEmployeeIds } }, select: { id: true, odooId: true, firstName: true, lastName: true, employeeNumber: true } }) : [];
        const employeeMap = new Map(employees.map(employee => [employee.odooId, employee]));
        const approvalMap = new Map<number, { name: string; state: string; writeDate?: string }[]>();
        if (model === 'approval.request' && rows.length) {
          const ids = await client.search('approval.approver', [['request_id', 'in', rows.map(row => row.id)]], { context: { active_test: false } }).catch(() => []);
          for (let offset = 0; offset < ids.length; offset += 500) {
            const lines = await client.read('approval.approver', ids.slice(offset, offset + 500), ['request_id', 'user_id', 'status', 'write_date']).catch(() => []);
            for (const line of lines) { const requestId = positiveId(line.request_id); if (requestId) approvalMap.set(requestId, [...(approvalMap.get(requestId) ?? []), { name: scalarText(line.user_id), state: scalarText(line.status), writeDate: scalarText(line.write_date) }]); }
          }
        }
        const existing = await prisma.appSetting.findMany({ where: { key: { startsWith: RECORD_PREFIX }, value: { path: ['source'], equals: source } }, select: { value: true } });
        const linked = new Map(existing.map(item => { const link = item.value as unknown as RequestLink; return [`${link.model}:${link.remoteId}`, link]; }));
        const references = new Map(existing.map(item => { const link = item.value as unknown as RequestLink; return [link.reference, link]; }));
        const verifiedStates = model === 'approval.request' && rows.length ? await client.read(model, rows.map(row => Number(row.id)), [descriptor.profile.state,'write_date']) : rows;
        const freshState = new Map(verifiedStates.map(row => [Number(row.id), row]));
        for (const row of rows) {
          try {
            const id = positiveId(row.id); if (!id || (!target && !retryPage && id <= lastId)) throw new Error('INVALID_CURSOR');
            const fresh = freshState.get(id);
            if (model === 'approval.request' && (!fresh || scalarText(fresh[descriptor.profile.state]) !== scalarText(row[descriptor.profile.state]) || scalarText(fresh.write_date) !== scalarText(row.write_date))) throw new Error('SOURCE_CHANGED');
            const owner = positiveId(row[descriptor.profile.owner]);
            const remoteEmployeeId = descriptor.profile.ownerKind === 'employee' ? owner : ownerEmployees.get(owner!)?.length === 1 ? ownerEmployees.get(owner!)![0] : null;
            const employee = remoteEmployeeId ? employeeMap.get(remoteEmployeeId) : null;
            if (!employee) { result.skipped++; failures.add(id); continue; }
            const marker = scalarText(row[descriptor.profile.reference]).match(/\[(LRQ-[A-Z0-9-]+)\]/)?.[1];
            const old = linked.get(`${model}:${id}`) ?? (marker ? references.get(marker) : undefined);
            if (old && old.employeeId !== employee.id) { result.errors.push('تغيرت هوية صاحب طلب مرتبط؛ يلزم مراجعة المطابقة'); failures.add(id); continue; }
            const now = new Date().toISOString();
            const link: RequestLink = old ?? { id: remoteKey(source, model, id), reference: `ODOO-${id}`, source, model, remoteId: id, employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, employeeNumber: employee.employeeNumber, title: scalarText(row[descriptor.profile.reference]) || descriptor.profile.label, origin: 'ODOO', bucket: 'UNKNOWN', syncState: 'SYNCED', attempts: 0, createdAt: row.create_date ? String(row.create_date).replace(' ', 'T') + 'Z' : now, updatedAt: now, events: [{ at: now, label: 'استُورد الطلب من أودو مع هويته الأصلية' }] };
            await applyRemote(link, row, descriptor, client, baseUrl, model === 'approval.request' ? approvalMap.get(id) ?? [] : undefined);
            failures.delete(id);
            result.imported++;
          } catch { const id = positiveId(row.id); if (id) failures.add(id); result.errors.push(`تعذر حفظ سجل من ${descriptor.profile.label}`); }
        }
        if (target) break;
        if (retryPage) continue;
        if (rows.length) { const next = positiveId(rows.at(-1)?.id); if (!next || next <= lastId) throw new Error('INVALID_CURSOR'); lastId = next; }
        const completed = rows.length < 500;
        // Failed/unmatched records remain eligible for the next pass.
        const next = completed ? { since: until, running: false, lastId: 0, failedIds: [...failures] } : { since, until, running: true, lastId, failedIds: [...failures] };
        await prisma.appSetting.upsert({ where: { key: checkpointKey }, create: { key: checkpointKey, value: next }, update: { value: next } });
        if (completed) break;
      }
    } catch { result.errors.push(`تعذرت قراءة نموذج ${model}؛ تحقق من الصلاحيات والحقول`); }
  }
  await prisma.appSetting.upsert({ where: { key: 'odoo.requests.lastSync' }, create: { key: 'odoo.requests.lastSync', value: { ...result, at: new Date().toISOString() } }, update: { value: { ...result, at: new Date().toISOString() } } });
  return result;
}

export async function enqueueWorkflowRequest(tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>, workflow: { id: string; type: string; entityId: string; employeeId: string }) {
  const setting = await tx.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  const config = setting?.value as unknown as Configuration | undefined;
  const leave = config?.enabled && workflow.type === 'LEAVE' ? await tx.leaveRequest.findUnique({ where: { id: workflow.entityId }, select: { leaveTypeId: true } }) : null;
  const mapping = config?.enabled ? config.mappings.find(item => item.type === workflow.type && !!item.leaveTypeId && item.leaveTypeId === leave?.leaveTypeId) ?? config.mappings.find(item => item.type === workflow.type && !item.leaveTypeId) : undefined;
  if (!mapping || !config?.source) return;
  const employee = await tx.employee.findUniqueOrThrow({ where: { id: workflow.employeeId }, select: { firstName: true, lastName: true, employeeNumber: true, userId: true } });
  const documents = await tx.appSetting.findUnique({ where: { key: `request.documents.${workflow.entityId}` }, select: { value: true } });
  const now = new Date().toISOString();
  const row: RequestLink = { id: `wf-${workflow.id}`, attachments: documents?.value as unknown as RequestLink['attachments'], workflowId: workflow.id, source: config.source, model: mapping.model, origin: 'LANA', employeeId: workflow.employeeId, employeeName: `${employee.firstName} ${employee.lastName}`, employeeNumber: employee.employeeNumber, createdBy: employee.userId ?? undefined, title: `${HR_APPROVAL_SERVICES.find(item => item.code === workflow.type)?.label ?? getRequestTypeConfig(workflow.type)?.label ?? workflow.type} · ${employee.firstName} ${employee.lastName}`, reference: `LRQ-${workflow.id.toUpperCase()}`, bucket: 'DRAFT', syncState: 'PENDING', attempts: 0, createdAt: now, updatedAt: now, events: [{ at: now, label: 'حُفظ الطلب المحلي وأُدرج في سجل إرسال أودو' }] };
  await tx.appSetting.create({ data: { key: recordKey(row.id), value: JSON.parse(JSON.stringify(row)), isSecret: true } });
  await tx.workflowStep.updateMany({ where: { workflowInstanceId: workflow.id, status: { in: ['PENDING', 'WAITING', 'DEFERRED'] } }, data: { status: 'EXTERNAL' } });
}
export async function dispatchWorkflowRequest(workflowId: string) {
  const linked = await getLink(`wf-${workflowId}`);
  if (!linked || linked.link.syncState === 'SYNCED') return;
  if (linked.link.values && linked.link.attempts > 0) return dispatchRequest(linked.link.id);
  const workflow = await prisma.workflowInstance.findUnique({ where: { id: workflowId } });
  if (!workflow) return;
  const config = await configuration();

  const delegate = workflow.type === 'LEAVE' ? prisma.leaveRequest : workflow.type === 'EXPENSE' ? prisma.expenseRequest : workflow.type === 'LOAN' ? prisma.loan : workflow.type === 'OVERTIME' ? prisma.overtimeRequest : workflow.type === 'RESUMPTION' ? prisma.resumptionRequest : prisma.letterRequest;
  const entity = await (delegate as unknown as { findUnique(input: { where: { id: string } }): Promise<Record<string, unknown> | null> }).findUnique({ where: { id: workflow.entityId } });
  if (!entity) return;
  const mapping = config.mappings.find(item => item.type === workflow.type && item.leaveTypeId && item.leaveTypeId === entity.leaveTypeId) ?? config.mappings.find(item => item.type === workflow.type && !item.leaveTypeId);
  if (!mapping) return;
  const values: Record<string, unknown> = { ...mapping.defaults, name: linked.link.title };
  if (mapping.categoryId) values.category_id = mapping.categoryId;
  if (mapping.model === 'approval.request') {
    const extra = await prisma.appSetting.findUnique({ where: { key: `request.fields.${workflow.entityId}` } });
    const details = extra?.value as { amount?: number; requestDate?: string; reference?: string; project?: string } | undefined;
    if (details?.amount != null) values.amount = details.amount;
    if (details?.requestDate) values.date = details.requestDate + 'T00:00:00+03:00';
    if (details?.reference) values.reference = details.reference;
    values.reason = (details?.project ? `المشروع / مركز التكلفة: ${details.project}\n` : '') + String(entity.purpose ?? entity.reason ?? entity.description ?? entity.notes ?? '') + '\n' + ['startDate', 'endDate', 'returnDate', 'workDate', 'hours', 'installmentAmount'].filter(key => entity[key] != null).map(key => `${key}: ${entity[key] instanceof Date ? (entity[key] as Date).toISOString() : String(entity[key])}`).join('\n');
    if (entity.amount != null || entity.principalAmount != null) values.amount = Number(entity.amount ?? entity.principalAmount);
  }
  if (mapping.model === 'hr.leave') {
    values.request_date_from = (entity.startDate as Date)?.toISOString().slice(0, 10);
    values.request_date_to = (entity.endDate as Date)?.toISOString().slice(0, 10);
    values.name = String(entity.reason ?? linked.link.title);
  }
  await saveLink({ ...linked.link, values, title: String(values.name) });
  return dispatchRequest(linked.link.id);
}
export async function retryPendingRequests(limit = 10) {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: RECORD_PREFIX }, OR: ['PENDING','ERROR','UNCERTAIN','SENDING'].map(syncState => ({ value: { path: ['syncState'], equals: syncState } })) }, take: limit * 3, orderBy: { updatedAt: 'asc' } });
  let processed = 0;
  for (const row of rows) {
    const link = row.value as unknown as RequestLink;
    if (link.syncState !== 'PENDING' && Date.now() - row.updatedAt.getTime() < Math.min(900000, 30000 * 2 ** Math.min(link.attempts, 5))) continue;
    if (link.attempts >= 10 && link.syncState === 'ERROR') { await saveLink({ ...link, syncState: 'BLOCKED', events: appendEvent(link.events, 'أوقفت المحاولات الآلية بعد تكرار التعثر؛ يلزم فحص المسؤول') }); continue; }
    if (link.workflowId) await dispatchWorkflowRequest(link.workflowId); else await dispatchRequest(link.id);
    if (++processed >= limit) break;
  }
}

export async function assertLocalWorkflow(workflowId: string, tx: Pick<typeof prisma, 'appSetting'> = prisma) {
  const linked = await tx.appSetting.findUnique({ where: { key: recordKey(`wf-${workflowId}`) }, select: { id: true } });
  if (linked) throw new Error('هذا الطلب مرتبط بمسار أودو. افتح الطلب في أودو لاتخاذ القرار أو التعديل ثم حدّث حالته في لانا.');
}

export async function syncOdooRequests(target?: { model: string; id: number }, maxPages = 3) {
  if (target) return pullOdooRequests(target, maxPages);
  if (!(await configuration()).enabled) return { enabled: false, imported: 0, errors: [] as string[] };
  const key = 'odoo.requests.pull.lease';
  const token = randomUUID();
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: { until: 0 } }, update: {} });
  const claim = await prisma.appSetting.updateMany({ where: { key, value: { path: ['until'], lte: Date.now() } }, data: { value: { until: Date.now() + 280000, token } } });
  if (claim.count !== 1) return { enabled: true, imported: 0, inProgress: true, errors: [] as string[] };
  try { return await pullOdooRequests(undefined, maxPages); }
  finally { await prisma.appSetting.updateMany({ where: { key, value: { path: ['token'], equals: token } }, data: { value: { until: Date.now() + 30000 } } }); }
}
// Native Studio events on approver lines carry the line's model/id. Resolve
// its parent through Odoo instead of trusting a client-supplied request_id.
export async function approvalRequestForApprover(id: number) {
  const config = await configuration();
  if (!config.enabled || !config.models.includes('approval.request')) throw new Error('تطبيق الموافقات غير مفعّل');
  const { client } = await requestConnection(config);
  const fields = await client.fieldsGet('approval.approver', ['request_id'], ['type','relation']);
  if (fields.request_id?.relation !== 'approval.request') throw new Error('تعذر توثيق علاقة مرحلة الموافقة بالطلب');
  const [line] = await client.read('approval.approver', [id], ['request_id']);
  const parent = positiveId(line?.request_id);
  if (!parent) throw new Error('طلب الموافقة غير موجود');
  return { model:'approval.request', id:parent };
}
