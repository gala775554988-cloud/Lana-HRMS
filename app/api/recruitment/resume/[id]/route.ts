import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.permissions, { action: "read", resource: "recruitment" }, session.user.roles as string[])) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({ where: { id }, select: { resumeUrl: true } });
  if (!candidate?.resumeUrl?.startsWith("data:application/pdf;base64,")) return new NextResponse("السيرة غير متاحة بهذا التنسيق", { status: 404 });
  await writeAuditLog({ actorUserId: session.user.id, action: "recruitment.resume.download", entity: "Candidate", entityId: id });
  return new NextResponse(Buffer.from(candidate.resumeUrl.split(",")[1], "base64"), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="resume.pdf"', "Cache-Control": "private, no-store" } });
}
