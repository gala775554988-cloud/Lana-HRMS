import { prisma } from '@/lib/prisma';
import { CONFIG_KEY, type Configuration } from './types';
// Read-only policy lookup; the transactional outbox re-checks the same setting
// before committing a routed request. An absent local HR path cannot block a
// general request explicitly delegated to Odoo's own approval engine.
export async function usesOdooRouting(type: string, tx: Pick<typeof prisma, 'appSetting'> = prisma) {
  const setting = await tx.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  const config = setting?.value as unknown as Configuration | undefined;
  return !!config?.enabled && config.mappings.some(item => item.type === type && !item.leaveTypeId && config.models.includes(item.model));
}
