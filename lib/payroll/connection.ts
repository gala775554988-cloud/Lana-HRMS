import { prisma } from "@/lib/prisma";
import { createOdooClientFromConnection } from "@/lib/integrations/odoo/sync";
export async function getPayrollOdooClient(connectionId?: string) {
  if (connectionId) {
    const allowed = await prisma.integrationConnection.findFirst({ where: { id: connectionId, provider: { type: "ODOO", isActive: true } }, select: { id: true } });
    if (!allowed) throw new Error("اتصال Odoo غير متاح");
    return createOdooClientFromConnection(allowed.id);
  }
  return createOdooClientFromConnection();
}
