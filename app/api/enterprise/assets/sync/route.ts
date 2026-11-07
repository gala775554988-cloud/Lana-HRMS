import type { OdooRecord } from "@/lib/integrations/odoo/types";
import { canManageIntegration } from "@/lib/integrations/access";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPayrollOdooClient } from "@/lib/payroll/connection";
import { importOdooAssets } from "@/lib/integrations/odoo/assets";
import { odooPayrollSource } from "@/lib/payroll/odoo-payroll";
import { revalidatePath } from "next/cache";

export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canManageIntegration(session.user)) return NextResponse.json({ success: false }, { status: 403 });
  const connections = await prisma.integrationConnection.findMany({
    where: { provider: { type: "ODOO", isActive: true } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });
  return NextResponse.json({ connections, configured: Boolean(process.env.ODOO_URL) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "سجل الدخول أولاً" }, { status: 401 });
  if (!canManageIntegration(session.user)) return NextResponse.json({ success: false, message: "صلاحية إدارة التكامل مطلوبة" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.connectionId !== undefined && (typeof body.connectionId !== "string" || !body.connectionId.trim())) {
      return NextResponse.json({ success: false, message: "اختر اتصال أودو صالحاً" }, { status: 400 });
    }
    const { client } = await getPayrollOdooClient(body.connectionId);
    const config = client.getConfig();
    const result = await importOdooAssets({
      execute: (model, method, args, kwargs) => client.executeKw(model, method, args, kwargs),
      searchRead: <T = Record<string, unknown>>(model: string, domain: unknown[] = [], fields: string[] = [], kwargs: Record<string, unknown> = {}) => client.searchRead<T & OdooRecord>(model, domain as never, fields, kwargs),
    }, odooPayrollSource(config.url, config.database));
    await prisma.auditLog.create({ data: { actorUserId: session.user.id, action: "odoo:assets-import", entity: "asset", metadata: result } });
    revalidatePath("/assets");
    return NextResponse.json({ success: true, created: result.createdCount, updated: result.updatedCount });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "تعذر استيراد العهد من أودو" }, { status: 409 });
  }
}
