import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyScopedWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const tab = request.nextUrl.searchParams.get("tab") ?? "pending";
  const mode = request.nextUrl.searchParams.get("mode") ?? "center";
  const profile = await getAccessProfile(session.user.id, (session.user.roles as string[]) ?? []);
  const employeeWhere = await applyScopedWhere("employees", {}, profile);

  const statusMap: Record<string, string[]> = {
    pending: ["PENDING"],
    approved: ["COMPLETED", "APPROVED"],
    rejected: ["REJECTED"],
    returned: ["RETURNED"],
    archived: ["ARCHIVED", "CANCELLED"]
  };

  const where: any = {
    employee: employeeWhere,
    ...(statusMap[tab] ? { status: { in: statusMap[tab] } } : {})
  };
  if (mode === "inbox") where.steps = { some: { approverUserId: session.user.id, status: "PENDING" } };
  if (mode === "outbox") where.steps = { some: { approverUserId: session.user.id, status: { in: ["APPROVED", "REJECTED", "RETURNED"] } } };

  const requests = await prisma.workflowInstance.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: { select: { name: true } }, branch: { select: { name: true } } } },
      steps: { orderBy: { step: "asc" } }
    },
    orderBy: { updatedAt: "desc" },
    take: 150
  });

  return NextResponse.json({ success: true, requests });
}
