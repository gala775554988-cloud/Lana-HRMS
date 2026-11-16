import { prisma } from '@/lib/prisma';
import { HR_APPROVAL_SERVICES, suggestHRCategoryMappings } from '@/lib/employee/hr-approval-services';
import { categoryCatalog, categoryDetails } from './categories';
import { configuration } from './store';
import { describeModel, requestConnection } from './service';
import { CONFIG_KEY, type Configuration } from './types';

// Fixed, verified defaults only: callers cannot select a connection, category or
// owner. Existing administrator configuration is never overwritten.
export async function automaticallySetupRequests(actorId: string) {
  const existing = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY }, select: { id: true } });
  if (existing) {
    const config = await configuration();
    return { config, configured: false, issues: config.enabled ? [] : HR_APPROVAL_SERVICES.map(service => ({ type: service.code, message: 'الربط موقوف في إعدادات المسؤول؛ يلزم إعادة تفعيله' })) };
  }
  const current = await configuration();
  const { client, source } = await requestConnection(current);
  const descriptor = await describeModel(client, 'approval.request');
  if (!descriptor.canCreate) throw new Error('حقول موافقات أودو تحتاج معالجة: ' + (descriptor.missing.join('، ') || 'النموذج لا يتيح إنشاء الطلبات'));
  const allowed = await client.execute_kw<boolean>('approval.request', 'check_access_rights', ['create'], { raise_exception: false });
  if (!allowed) throw new Error('حساب الاتصال بأودو لا يملك صلاحية إنشاء طلبات الموافقات');
  const categories = await categoryCatalog(client);
  const suggested = suggestHRCategoryMappings(categories);
  const mappings: Configuration['mappings'] = [];
  const issues: { type: string; message: string }[] = [];
  for (const service of HR_APPROVAL_SERVICES) {
    const mapping = suggested.find(item => item.type === service.code);
    if (!mapping) { issues.push({ type: service.code, message: 'لم يوجد تصنيف مطابق وفريد في أودو' }); continue; }
    try {
      const details = await categoryDetails(client, mapping.categoryId!, descriptor.fields);
      const unsupported = [...details.unsupported, ...details.requiredFields.filter(name => !descriptor.formFields.includes(name))];
      if (unsupported.length) { issues.push({ type: service.code, message: 'حقول تحتاج دعمًا: ' + unsupported.join('، ') }); continue; }
      mappings.push(mapping);
    } catch { issues.push({ type: service.code, message: 'تعذر قراءة متطلبات التصنيف من أودو' }); }
  }
  if (!mappings.length) return { config: current, configured: false, issues };
  const config: Configuration = { ...current, enabled: true, source, models: ['approval.request'], mappings };
  const configured = await prisma.$transaction(async tx => {
    // Concurrent page opens must neither overwrite nor reset manual settings.
    const inserted = await tx.appSetting.createMany({ data: [{ key: CONFIG_KEY, value: JSON.parse(JSON.stringify(config)) }], skipDuplicates: true });
    if (!inserted.count) return false;
    await tx.auditLog.create({ data: { actorUserId: actorId, action: 'odoo-requests:auto-configure', entity: 'AppSetting', entityId: CONFIG_KEY, metadata: { source, types: mappings.map(item => item.type) } } });
    return true;
  });
  return { config: await configuration(), configured, issues };
}
