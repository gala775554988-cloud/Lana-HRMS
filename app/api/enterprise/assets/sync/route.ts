import { canManageIntegration } from "@/lib/integrations/access";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncMapping } from "@/lib/integrations/service";

export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "سجل الدخول أولاً" }, { status: 401 });
  if (!canManageIntegration(session.user)) {
    return NextResponse.json({ success: false, message: "صلاحية إدارة التكامل مطلوبة" }, { status: 403 });
  }
  const connections = await prisma.integrationConnection.findMany({
    where: { provider: { type: "ODOO", isActive: true } },
    select: { id: true, providerId: true },
    take: 2,
  });
  if (connections.length !== 1) return NextResponse.json({
    success: false, message: "يلزم اتصال Odoo واحد مفعّل. راجع إعدادات التكامل وحدد اتصال العهد.",
  }, { status: 409 });
  const connection = connections[0];
  const mappings = await prisma.integrationMapping.findMany({
    where: { providerId: connection.providerId, hrmsModule: "assets", hrmsModel: "asset", externalModel: "maintenance.equipment", isActive: true },
    select: { id: true }, take: 2,
  });
  if (mappings.length !== 1) return NextResponse.json({
    success: false, message: "خريطة استيراد العهد غير جاهزة. راجع خريطة الأصول في إعدادات التكامل.",
  }, { status: 409 });
  try {
    const result = await syncMapping(connection.id, mappings[0].id, "ODOO_TO_HRMS");
    return NextResponse.json({ success: true, created: result.createdCount, updated: result.updatedCount, processed: result.pulled });
  } catch (error) {
    return NextResponse.json({
      success: false, message: error instanceof Error ? error.message : "تعذر استيراد العهد. راجع اتصال أودو.",
    }, { status: 409 });
  }
}
