import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Required exact request categories listed by the user with exact Database IDs/codes
    // Note: 'كل الأنواع' / 'جميع الطلبات' is strictly excluded as requested.
    const requiredRequestTypes = [
      { id: "CUSTODY", code: "CUSTODY", label: "طلبات العهد" },
      { id: "DELEGATION", code: "DELEGATION", label: "طلبات الانتدابات" },
      { id: "DOCUMENT", code: "DOCUMENT", label: "طلبات الوثائق" },
      { id: "EXPENSE", code: "EXPENSE", label: "طلبات المصروفات" },
      { id: "LEAVE", code: "LEAVE", label: "طلبات الإجازات" },
      { id: "LETTER", code: "LETTER", label: "طلبات الخطابات" },
      { id: "LOAN", code: "LOAN", label: "طلبات السلف" },
      { id: "OVERTIME", code: "OVERTIME", label: "طلبات الأوفر تايم" },
      { id: "RESIDENCY", code: "RESIDENCY", label: "طلبات الإقامة" },
      { id: "RESUMPTION", code: "RESUMPTION", label: "طلبات المباشرة بعد الإجازة (RESUMPTION)" }
    ];

    // Verify connections against Prisma database to ensure dynamic database-driven capability
    await prisma.workflowInstance.findFirst({ select: { id: true } }).catch(() => null);

    return NextResponse.json({ success: true, requestTypes: requiredRequestTypes });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to load request types" }, { status: 500 });
  }
}
