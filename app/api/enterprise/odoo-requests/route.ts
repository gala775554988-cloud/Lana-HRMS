import { permittedPartnerIds } from '@/lib/integrations/odoo/requests/relations';
import { categoryDetails } from '@/lib/integrations/odoo/requests/categories';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { canManageApprovalRouting, REQUEST_CATEGORIES } from '@/config/request-routing';
import { getAccessProfile, applyScopedWhere, canAccessEmployeeId } from '@/lib/enterprise/hierarchy';
import { canSubmitForEmployee } from '@/lib/self-service/request-submitter';
import { configuration, getLink } from '@/lib/integrations/odoo/requests/store';
import { configureRequests, createRemoteRequest, describeModel, discoverModels, dispatchRequest, dispatchWorkflowRequest, requestConnection, retryPendingRequests, syncOdooRequests } from '@/lib/integrations/odoo/requests/service';
import { BUCKET_LABELS, positiveId, PUBLIC_REQUEST_FIELDS } from '@/lib/integrations/odoo/requests/profiles';
import { RECORD_PREFIX, WEBHOOK_KEY, type RequestLink } from '@/lib/integrations/odoo/requests/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const model = z.string().regex(/^[a-z][a-z0-9_.]{2,100}$/);
const configurationSchema = z.object({ enabled: z.boolean(), connectionId: z.string().max(100).optional(), models: z.array(model).max(20), mappings: z.array(z.object({ type: z.enum(REQUEST_CATEGORIES.map(item => item.code) as [string, ...string[]]), model, categoryId: z.number().int().positive().optional(), leaveTypeId: z.string().max(100).optional(), defaults: z.record(z.union([z.string().max(8000), z.number().finite(), z.boolean()])).default({}) }).strict()).max(30) }).strict();
const privateFields = (row: RequestLink, canConfigure = false) => { const { attachments: _attachments, privilegedRelations: _privilegedRelations, values: _values, source: _source, createdBy: _createdBy, leaseUntil: _lease, ...safe } = row; return { ...safe, fields: canConfigure ? safe.fields : safe.fields?.filter(field => !!field.name && PUBLIC_REQUEST_FIELDS.has(field.name)) }; };
async function access(user: { id: string; roles?: string[]; permissions?: string[] }) {
  const profile = await getAccessProfile(user.id, user.roles ?? []);
  return { profile, canConfigure: canManageApprovalRouting(user.roles, user.permissions) };
}
async function canRead(row: RequestLink, userId: string, profile: Awaited<ReturnType<typeof getAccessProfile>>) {
  return row.employeeId ? canAccessEmployeeId(row.employeeId, profile) : row.createdBy === userId;
}
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const { profile, canConfigure } = await access(session.user);
    const config = await configuration();
    const params = request.nextUrl.searchParams;
    const action = params.get('action');
    if (action === 'describe' || action === 'options' || action === 'category') {
      const selectedModel = params.get('model') ?? '';
      if (!config.enabled || !config.models.includes(selectedModel)) throw new Error('نموذج غير مفعّل');
      const { client } = await requestConnection(config);
      const descriptor = await describeModel(client, selectedModel);
      if (action === 'category') {
        const id = positiveId(params.get('id'));
        if (selectedModel !== 'approval.request' || !id || !config.mappings.some(item => item.model === selectedModel && item.categoryId === id)) throw new Error('تصنيف غير مفعّل');
        return NextResponse.json({ success: true, category: await categoryDetails(client, id, descriptor.fields) });
      }
      if (action === 'describe') {
        const missing = descriptor.formFields.filter(name => !PUBLIC_REQUEST_FIELDS.has(name) && descriptor.fields[name].required && descriptor.defaults[name] == null);
        const safe = canConfigure ? descriptor : { ...descriptor, fields: Object.fromEntries(Object.entries(descriptor.fields).filter(([name])=>PUBLIC_REQUEST_FIELDS.has(name))), defaults: Object.fromEntries(Object.entries(descriptor.defaults).filter(([name])=>PUBLIC_REQUEST_FIELDS.has(name))), formFields: descriptor.formFields.filter(name=>PUBLIC_REQUEST_FIELDS.has(name)), missing:[...descriptor.missing,...missing], canCreate:descriptor.canCreate&&!missing.length };
        return NextResponse.json({success:true,descriptor:safe});
      }
      const field = params.get('field') ?? '';
      const definition = descriptor.fields[field];
      const allowedRelations = new Set(['approval.category', 'hr.leave.type', 'res.currency', 'uom.uom', 'res.partner']);
      if (!descriptor.formFields.includes(field) || definition?.type !== 'many2one' || !allowedRelations.has(definition.relation ?? '')) throw new Error('تحتاج هذه العلاقة ضبطًا من مسؤول الربط');
      let ids: number[] | null = selectedModel === 'approval.request' && field === 'category_id' ? config.mappings.filter(item => item.model === selectedModel).map(item => item.categoryId).filter((id): id is number => !!id) : selectedModel === 'hr.leave' && field === 'holiday_status_id' ? config.mappings.filter(item => item.model === selectedModel).map(item => positiveId(item.defaults.holiday_status_id)).filter((id): id is number => !!id) : null;
      if (definition.relation === 'res.partner' && !canConfigure) {
        const employee = await prisma.employee.findFirst({where:{userId:session.user.id},select:{odooId:true}});
        ids = employee?.odooId ? await permittedPartnerIds(client, employee.odooId, config, selectedModel, positiveId(params.get('categoryId')) ?? undefined, field) : [];
      }
      const search = (params.get('search') ?? '').trim().slice(0,100);
      const domain = [...(ids ? [['id','in',ids] as [string,'in',number[]]] : []), ...(search.length>=2 ? [['display_name','ilike',search] as [string,'ilike',string]] : [])];
      const rows = await client.search_read(definition.relation!, domain, ['id', 'display_name'], { limit: 200, order: 'id asc' });
      return NextResponse.json({ success: true, options: rows.map(item => ({ id: item.id, label: item.display_name })) });
    }
    const employeeWhere = await applyScopedWhere('employees', {}, profile);
    const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true } });
    const visibility = employees.map(employee => ({ value: { path: ['employeeId'], equals: employee.id } }));
    const filters: object[] = [{ key: { startsWith: RECORD_PREFIX } }, { OR: visibility.length ? visibility : [{ key: '__none__' }] }];
    const origin = params.get('origin');
    if (origin && !['LANA', 'ODOO'].includes(origin)) throw new Error('مصدر الطلب غير صالح');
    if (origin) filters.push({ value: { path: ['origin'], equals: origin } });
    const sourceFilters = [...filters];
    const bucket = params.get('bucket');
    const sync = params.get('sync');
    const search = params.get('search')?.trim().slice(0, 100);
    if (bucket && Object.keys(BUCKET_LABELS).includes(bucket)) filters.push({ value: { path: ['bucket'], equals: bucket } });
    if (sync === 'attention') filters.push({ OR: ['ERROR', 'UNCERTAIN', 'BLOCKED'].map(state => ({ value: { path: ['syncState'], equals: state } })) });
    if (search) filters.push({ OR: ['title', 'reference', 'remoteReference', 'employeeName', 'employeeNumber'].map(field => ({ value: { path: [field], string_contains: search } })) });
    const rawPage = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
    const where = { AND: filters };
    const [rows, total, summaries, latest, webhook] = await Promise.all([
      prisma.appSetting.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], select: { value: true } }),
      prisma.appSetting.count({ where }),
      Promise.all(Object.keys(BUCKET_LABELS).map(async state => [state, await prisma.appSetting.count({ where: { AND: [...sourceFilters, { value: { path: ['bucket'], equals: state } }] } })] as const)),
      prisma.appSetting.findUnique({ where: { key: 'odoo.requests.lastSync' }, select: { value: true } }),
      prisma.appSetting.findUnique({ where: { key: WEBHOOK_KEY }, select: { id: true } }),
    ]);
    return NextResponse.json({ success: true, rows: rows.map(row => privateFields(row.value as unknown as RequestLink, canConfigure)), total, page, counts: Object.fromEntries(summaries), canConfigure, config: canConfigure ? config : { enabled: config.enabled, models: config.models, mappings: config.mappings.map(({type,model,categoryId,leaveTypeId,defaults}) => ({type,model,categoryId,leaveTypeId,defaults: defaults.holiday_status_id ? {holiday_status_id:defaults.holiday_status_id} : {}})) }, latestSync: canConfigure ? latest?.value : null, realtimeEnabled: !!webhook, requestTypes: REQUEST_CATEGORIES });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error && !('code' in error) ? error.message : 'تعذر تحميل مركز الطلبات' }, { status: 400 }); }
}
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ success: false }, { status: 403 });
    const { profile, canConfigure } = await access(session.user);
    if (Number(request.headers.get('content-length')) > 4000000) throw new Error('حجم الطلب كبير');
    const body = await request.json();
    if (['discover', 'configure', 'sync', 'webhook', 'category-options', 'leave-options', 'category-detail'].includes(body.action) && !canConfigure) return NextResponse.json({ success: false }, { status: 403 });
    if (body.action === 'discover') return NextResponse.json({ success: true, ...(await discoverModels(typeof body.connectionId === 'string' ? body.connectionId : undefined)) });
    if (body.action === 'category-detail') {
      const { client } = await requestConnection({ ...(await configuration()), connectionId: body.connectionId || undefined });
      const id = positiveId(body.categoryId); if (!id) throw new Error('تصنيف غير صالح');
      const descriptor = await describeModel(client, 'approval.request');
      return NextResponse.json({ success: true, category: await categoryDetails(client, id, descriptor.fields) });
    }
    if (body.action === 'leave-options') {
      const { client } = await requestConnection({ ...(await configuration()), connectionId: body.connectionId || undefined });
      const options = await client.search_read('hr.leave.type', [], ['id', 'name'], { limit: 500 });
      const local = await prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, name: true } });
      return NextResponse.json({ success: true, local, options: options.map(row => ({ id: row.id, label: row.name })) });
    }
    if (body.action === 'category-options') {
      const { client } = await requestConnection({ ...(await configuration()), connectionId: body.connectionId || undefined });
      const rows = await client.search_read('approval.category', [], ['id', 'name'], { limit: 500 });
      return NextResponse.json({ success: true, options: rows.map(row => ({ id: row.id, label: row.name })) });
    }
    if (body.action === 'configure') return NextResponse.json({ success: true, config: await configureRequests(configurationSchema.parse(body.config), session.user.id) });
    if (body.action === 'webhook') {
      const secret = randomBytes(32).toString('hex');
      await prisma.$transaction(async tx => {
        await tx.appSetting.upsert({ where: { key: WEBHOOK_KEY }, create: { key: WEBHOOK_KEY, value: { hash: createHash('sha256').update(secret).digest('hex') }, isSecret: true }, update: { value: { hash: createHash('sha256').update(secret).digest('hex') }, isSecret: true } });
        await tx.auditLog.create({ data: { actorUserId: session.user.id, action: 'odoo-requests:rotate-webhook', entity: 'AppSetting', entityId: WEBHOOK_KEY } });
      });
      return NextResponse.json({ success: true, secret, url: new URL('/api/integrations/webhooks/odoo-requests', request.url).href });
    }
    if (body.action === 'sync') { await retryPendingRequests(5); return NextResponse.json({ success: true, result: await syncOdooRequests() }); }
    if (body.action === 'submit') {
      const parsed = z.object({ employeeId: z.string().optional(), model, values: z.record(z.unknown()), attachments: z.array(z.object({name:z.string().max(150),data:z.string().max(2000000)}).strict()).max(5).optional(), idempotencyKey: z.string().uuid() }).parse(body);
      const own = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      const employeeId = parsed.employeeId || own?.id;
      if (!employeeId || (employeeId !== own?.id && !await canSubmitForEmployee(session.user, employeeId))) return NextResponse.json({ success: false, message: 'صاحب الطلب خارج صلاحياتك' }, { status: 403 });
      const row = await createRemoteRequest({ ...parsed, employeeId, actorId: session.user.id, privilegedRelations: canConfigure });
      return NextResponse.json({ success: true, row: row ? privateFields(row, canConfigure) : null }, { status: row?.syncState === 'SYNCED' ? 201 : 202 });
    }
    if (['retry', 'refresh'].includes(body.action)) {
      const parsed = z.object({ id: z.string().min(1).max(100) }).parse(body);
      const item = await getLink(parsed.id);
      if (!item || !await canRead(item.link, session.user.id, profile)) return NextResponse.json({ success: false }, { status: 404 });
      if (body.action === 'retry') {
        if (item.link.createdBy !== session.user.id && !canConfigure) return NextResponse.json({ success: false }, { status: 403 });
        if (item.link.workflowId) await dispatchWorkflowRequest(item.link.workflowId); else await dispatchRequest(parsed.id);
      } else if (item.link.remoteId) { const result = await syncOdooRequests({ model: item.link.model, id: item.link.remoteId }); if (!result.imported || result.errors.length) throw new Error('تعذر تحديث الطلب أو مطابقة هويته في أودو؛ راجع المصدر'); }
      const updated = await getLink(parsed.id);
      return NextResponse.json({ success: true, row: updated ? privateFields(updated.link, canConfigure) : null });
    }
    return NextResponse.json({ success: false }, { status: 400 });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof z.ZodError ? 'تحقق من الحقول وإعدادات الربط' : error instanceof Error && !('code' in error) ? error.message : 'تعذر تنفيذ العملية في أودو؛ لم يُسجل نجاح غير مؤكد' }, { status: 400 }); }
}
