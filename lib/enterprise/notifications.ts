import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "./notifications-service";

export type EnterpriseNotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export async function createEnterpriseNotification({
  userId,
  title,
  body,
  type = "INFO",
  dedupe = false,
  pushToMobile = false
}: {
  userId?: string | null;
  title: string;
  body: string;
  type?: EnterpriseNotificationType;
  dedupe?: boolean;
  pushToMobile?: boolean;
}) {
  if (dedupe) {
    const existing = await prisma.notification.findFirst({
      where: { userId: userId ?? null, title, body, readAt: null }
    });
    if (existing) return existing;
  }

  const notification = await prisma.notification.create({
    data: { userId: userId ?? null, title, body, type }
  });

  if (userId && (pushToMobile || type === "WARNING" || type === "ERROR")) {
    await sendPushNotification(userId, title, body).catch(() => null);
  }

  return notification;
}

export async function notifyUsers(userIds: Array<string | null | undefined>, title: string, body: string, type: EnterpriseNotificationType = "INFO") {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  await Promise.all(uniqueUserIds.map((userId) => createEnterpriseNotification({ userId, title, body, type })));
}

export async function notifyRole(roleNames: string[], title: string, body: string, type: EnterpriseNotificationType = "INFO") {
  const users = await prisma.user.findMany({
    where: { roles: { some: { role: { name: { in: roleNames } } } }, isActive: true },
    select: { id: true }
  });
  await notifyUsers(users.map((user) => user.id), title, body, type);
}

function documentExpiryTitle(type: string | null | undefined) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized.includes("insurance") || normalized.includes("تأمين")) return "انتهاء تأمين";
  if (normalized.includes("residency") || normalized.includes("iqama") || normalized.includes("إقامة")) return "انتهاء إقامة";
  if (normalized.includes("passport") || normalized.includes("جواز")) return "انتهاء جواز";
  if (normalized.includes("identity") || normalized.includes("national") || normalized.includes("هوية")) return "انتهاء هوية";
  return "انتهاء مستند";
}

export async function ensureExpiryNotificationsForUser(userId: string) {
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true, firstName: true, lastName: true } });
  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  if (employee) {
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: employee.id, expiresAt: { gte: now, lte: soon } },
      select: { id: true, type: true, name: true, expiresAt: true }
    });
    for (const document of documents) {
      await createEnterpriseNotification({
        userId,
        title: documentExpiryTitle(document.type),
        body: `${document.name} expires on ${document.expiresAt?.toISOString().slice(0, 10)}`,
        type: "WARNING",
        dedupe: true
      });
    }

    const contracts = await prisma.employeeContract.findMany({
      where: { employeeId: employee.id, endDate: { gte: now, lte: soon } },
      select: { id: true, title: true, endDate: true }
    });
    for (const contract of contracts) {
      await createEnterpriseNotification({
        userId,
        title: "انتهاء عقد",
        body: `${contract.title} expires on ${contract.endDate?.toISOString().slice(0, 10)}`,
        type: "WARNING",
        dedupe: true
      });
    }
  }
}
