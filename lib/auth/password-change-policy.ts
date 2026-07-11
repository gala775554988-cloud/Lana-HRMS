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
  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } }).catch(() => undefined);
  await writeStore(store);
}

export async function clearPasswordChangeRequirement(userId: string) {
  const store = await readStore();
  if (store[userId]) {
    delete store[userId];
    await writeStore(store);
  }
  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: false, passwordChanged: true, passwordChangedAt: new Date() } }).catch(() => undefined);
}

export async function isPasswordChangeRequired(userId: string) {
  const [store, user] = await Promise.all([
    readStore(),
    prisma.user.findUnique({ where: { id: userId }, select: { mustChangePassword: true } }).catch(() => null)
  ]);
  const dbRequires = Boolean(user?.mustChangePassword);
  if (!dbRequires && store[userId]) {
    delete store[userId];
    await writeStore(store).catch(() => undefined);
    return false;
  }
  return dbRequires || Boolean(store[userId]);
}
