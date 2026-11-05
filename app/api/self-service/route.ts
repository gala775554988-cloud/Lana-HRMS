import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false, message: "حسابك غير مرتبط بموظف" }, { status: 403 });
  const raw = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
  const where = { employeeId: employee.id, status: { not: "SUPERSEDED" } };
  const [requests, total, leaveTypes] = await Promise.all([
    prisma.workflowInstance.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { steps: { orderBy: { step: "asc" }, select: { step: true, status: true, comments: true } } } }),
    prisma.workflowInstance.count({ where }),
    prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ success: true, requests, total, page, leaveTypes });
}
