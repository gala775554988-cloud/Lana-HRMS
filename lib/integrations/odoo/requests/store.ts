import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { Configuration, RequestLink } from './types';
import { CONFIG_KEY, RECORD_PREFIX } from './types';
export const recordKey = (id: string) => `${RECORD_PREFIX}${id}`;
export const remoteKey = (source: string, model: string, id: number) => createHash('sha256').update(`${source}:${model}:${id}`).digest('hex');
export async function configuration(): Promise<Configuration> {
  const setting = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  return setting?.value as unknown as Configuration ?? { enabled: false, models: [], mappings: [] };
}
export async function getLink(id: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key: recordKey(id) } });
  return setting ? { setting, link: setting.value as unknown as RequestLink } : null;
}
export async function saveLink(link: RequestLink) {
  const value = JSON.parse(JSON.stringify(link));
  await prisma.appSetting.upsert({ where: { key: recordKey(link.id) }, create: { key: recordKey(link.id), value, isSecret: true }, update: { value, isSecret: true } });
}
export async function workflowLinks(ids: string[]) {
  const settings = ids.length ? await prisma.appSetting.findMany({ where: { key: { in: ids.map(id => recordKey(`wf-${id}`)) } }, select: { value: true } }) : [];
  return new Map(settings.map(item => { const row = item.value as unknown as RequestLink; return [row.workflowId, { reference: row.reference, syncState: row.syncState, remoteReference: row.remoteReference, remoteId: row.remoteId, remoteState: row.remoteState, bucket: row.bucket, lastSyncedAt: row.lastSyncedAt, error: row.error, remoteUrl: row.remoteUrl }]; }));
}
