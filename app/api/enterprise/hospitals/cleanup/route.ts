import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOdooIntegrationAccess } from "@/lib/integrations/odoo/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Data Sanitization & Cleanup Endpoint:
 * Deletes all corrupted Hospital and Branch records (names containing `%`, `غير محدد`, or blank strings)
 * from Neon PostgreSQL database.
 */
export async function POST(request: NextRequest) {
  try {
    await requireOdooIntegrationAccess("manage", request);

    const deletedHospitals = await prisma.hospital.deleteMany({
      where: { OR: [{ name: { contains: "%" } }, { name: "غير محدد" }, { name: "" }] }
    });
    const deletedBranches = await prisma.branch.deleteMany({
      where: { OR: [{ name: { contains: "%" } }, { name: "غير محدد" }, { name: "" }] }
    });

    return NextResponse.json({
      success: true,
      message: `تم تنظيف البيانات بنجاح: تم حذف (${deletedHospitals.count}) سجل مستشفى تالف و (${deletedBranches.count}) سجل فرع تالف.`,
      deletedHospitals: deletedHospitals.count,
      deletedBranches: deletedBranches.count
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
