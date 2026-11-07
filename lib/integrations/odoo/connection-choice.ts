import { prisma } from "@/lib/prisma";

/** A tested saved connection takes priority over legacy deployment variables. */
export async function getDefaultOdooConnectionId(hasEnvironmentConnection: boolean): Promise<string | undefined> {
  const active = { provider: { type: "ODOO" as const, isActive: true } };
  const tested = await prisma.integrationConnection.findMany({ where: { ...active, status: "CONNECTED" }, select: { id: true }, take: 2 });
  if (tested.length > 1) throw new Error("توجد عدة اتصالات أودو مختبرة. حدد الاتصال المطلوب للمزامنة.");
  if (tested.length === 1) return tested[0].id;
  if (hasEnvironmentConnection) return undefined;
  const saved = await prisma.integrationConnection.findMany({ where: active, select: { id: true }, take: 2 });
  if (saved.length !== 1) throw new Error("أضف اتصال أودو واختبره من صفحة الاتصالات، أو حدد اتصالاً واحداً للمزامنة.");
  return saved[0].id;
}
