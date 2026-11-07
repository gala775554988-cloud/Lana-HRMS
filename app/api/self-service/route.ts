import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRequestTypeConfig } from "@/lib/employee/request-form-config";

const requestStatuses = new Set(["PENDING", "COMPLETED", "REJECTED", "RETURNED", "CANCELLED"]);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false, message: "حسابك غير مرتبط بموظف" }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const status = query.get("status");
  const type = query.get("type");
  if ((status && !requestStatuses.has(status)) || (type && type !== "REVOKE" && !getRequestTypeConfig(type))) {
    return NextResponse.json({ success: false, message: "فلتر الطلبات غير صالح" }, { status: 400 });
  }
  const raw = Number(query.get("page") ?? 1);
  const page = Number.isSafeInteger(raw) && raw > 0 && raw <= 1_000_000 ? raw : 1;
  const where = { employeeId: employee.id, status: status || { not: "SUPERSEDED" }, ...(type ? { type } : {}) };
  const [requests, total, leaveTypes] = await Promise.all([
    prisma.workflowInstance.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { steps: { orderBy: { step: "asc" }, select: { step: true, status: true, comments: true } } } }),
    prisma.workflowInstance.count({ where }),
    prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ success: true, requests, total, page, leaveTypes });
}
