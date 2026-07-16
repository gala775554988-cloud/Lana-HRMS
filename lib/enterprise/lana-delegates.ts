import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

/**
 * Authorization list for Lana AI's "executive" commands (editing approval
 * chains, assigning responsibilities) -- deliberately separate from the
 * generic role/permission system: being SUPER_ADMIN or HR_MANAGER does NOT
 * by itself grant this, since it's a narrower, higher-trust capability the
 * admin grants to specific named people. SUPER_ADMIN is the one exception --
 * they're the one who manages this list, so they always have it too.
 */

const STORE_KEY = "enterprise.lanaDelegates";

type Store = { version: 1; userIds: string[] };

function normalizeStore(value: unknown): Store {
  if (!value || typeof value !== "object") return { version: 1, userIds: [] };
  const raw = value as { userIds?: unknown };
  return {
    version: 1,
    userIds: Array.isArray(raw.userIds) ? Array.from(new Set(raw.userIds.filter((id): id is string => typeof id === "string"))) : []
  };
}

export async function getLanaDelegateIds(): Promise<string[]> {
  const setting = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null);
  return normalizeStore(setting?.value).userIds;
}

export async function isLanaDelegate(userId: string, roles: string[] = []): Promise<boolean> {
  if (roles.includes("SUPER_ADMIN")) return true;
  const delegateIds = await getLanaDelegateIds();
  if (delegateIds.includes(userId)) return true;
  const dbSuperAdmin = await prisma.userRole.findFirst({
    where: { userId, role: { name: "SUPER_ADMIN" } }
  }).catch(() => null);
  return Boolean(dbSuperAdmin);
}

export async function setLanaDelegateIds(actorUserId: string, userIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter((id) => typeof id === "string" && id.length > 0)));
  await prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    update: { value: { version: 1, userIds: unique } },
    create: { key: STORE_KEY, value: { version: 1, userIds: unique }, description: "Users authorized to issue Lana AI executive (approval-chain-editing) commands" }
  });
  await writeAuditLog({ actorUserId, action: "lana-delegates:update", entity: "lanaDelegates", metadata: { userIds: unique } });
  return unique;
}
