import { prisma } from "@/lib/prisma";

const KEY = "employee.passwordChangeRequired";

type Store = Record<string, boolean>;

async function readStore(): Promise<Store> {
  const setting = await prisma.appSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  return setting?.value && typeof setting.value === "object" ? setting.value as Store : {};
}

async function writeStore(store: Store) {
  return prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value: store },
    create: { key: KEY, value: store, description: "Users required to change auto-generated employee password" }
  });
}

export async function requirePasswordChange(userId: string) {
  const store = await readStore();
  store[userId] = true;
  await writeStore(store);
}

export async function clearPasswordChangeRequirement(userId: string) {
  const store = await readStore();
  if (!store[userId]) return;
  delete store[userId];
  await writeStore(store);
}

export async function isPasswordChangeRequired(userId: string) {
  const store = await readStore();
  return Boolean(store[userId]);
}
