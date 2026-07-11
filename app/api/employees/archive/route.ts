import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, archiveReason, unarchive } = body;

    if (!employeeId) {
      return NextResponse.json({ success: false, message: "employeeId required" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    if (unarchive) {
      // Unarchive: set status ACTIVE, clear archivedAt and archiveReason
      const updated = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          status: "ACTIVE",
          archivedAt: null,
          archiveReason: null,
          terminationDate: null,
        },
      });
      return NextResponse.json({ success: true, message: "تم إلغاء الأرشفة", employee: updated });
    } else {
      // Archive: set status INACTIVE, archivedAt now, archiveReason
      const updated = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          status: "INACTIVE",
          archivedAt: new Date(),
          archiveReason: archiveReason || "تمت الأرشفة يدوياً",
          terminationDate: employee.terminationDate || new Date(),
        },
      });
      return NextResponse.json({ success: true, message: "تمت الأرشفة بنجاح", employee: updated });
    }
  } catch (error) {
    console.error("[archive] error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
