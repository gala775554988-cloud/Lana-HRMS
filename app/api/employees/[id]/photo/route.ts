import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Employee photos are stored as base64 data URIs (synced from Odoo's
// image_1920), which previously got embedded directly in every list-page
// payload -- a single page of 50 employees could ship 1.5MB+ of avatar data
// before any list text was rendered. Serving photos through their own
// endpoint lets the browser fetch them as separate, lazy, cacheable image
// requests instead of inline JSON/HTML weight.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id }, select: { profilePhotoUrl: true } });
  const dataUrl = employee?.profilePhotoUrl;
  if (!dataUrl) return NextResponse.json({ success: false, message: "No photo" }, { status: 404 });

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ success: false, message: "Invalid photo data" }, { status: 500 });

  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600"
    }
  });
}
