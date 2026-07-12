import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const result = await prisma.employee.updateMany({
      where: {
        status: { in: ["INACTIVE", "TERMINATED"] },
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        archiveReason: "أرشفة جماعية تلقائية — موظف غير نشط",
      },
    });

    return NextResponse.json({
      success: true,
      message: `تمت أرشفة ${result.count} موظف غير نشط`,
      archived: result.count,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
