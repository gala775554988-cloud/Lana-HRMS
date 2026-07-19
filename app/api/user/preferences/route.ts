import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { sidebarHue: true }
    });

    return NextResponse.json({
      success: true,
      sidebarHue: user?.sidebarHue ?? 270
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.sidebarHue !== "number") {
      return NextResponse.json({ success: false, message: "Invalid sidebarHue" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { sidebarHue: body.sidebarHue }
    });

    return NextResponse.json({
      success: true,
      sidebarHue: updated.sidebarHue,
      message: "✓ تم حفظ تدرج ألوان القائمة الجانبية بنجاح في قاعدة البيانات"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to save preferences" }, { status: 500 });
  }
}
