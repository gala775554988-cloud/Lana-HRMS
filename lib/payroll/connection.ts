import { prisma } from "@/lib/prisma";
import { createOdooClientFromConnection } from "@/lib/integrations/odoo/sync";
export async function getPayrollOdooClient(connectionId?: string) {
  if (connectionId) {
    const allowed = await prisma.integrationConnection.findFirst({ where: { id: connectionId, provider: { type: "ODOO", isActive: true } }, select: { id: true } });
    if (!allowed) throw new Error("اتصال Odoo غير متاح");
    return createOdooClientFromConnection(allowed.id);
  }
  if (process.env.ODOO_URL) return createOdooClientFromConnection();
  const existing = await prisma.integrationConnection.findMany({ where: { provider: { type: "ODOO", isActive: true } }, select: { id: true }, take: 2 });
  if (existing.length !== 1) throw new Error("حدد اتصال Odoo واحداً في إعداد القيد أو إعدادات التكامل");
  return createOdooClientFromConnection(existing[0].id);
}
