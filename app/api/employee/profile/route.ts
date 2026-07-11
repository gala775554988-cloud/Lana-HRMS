import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const allowedEmployeeFields = ["profilePhotoUrl", "phone", "email", "address", "gender", "dateOfBirth", "emergencyContact"] as const;

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true, userId: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const field of allowedEmployeeFields) {
    if (field in body) {
      if (field === "dateOfBirth") data[field] = body[field] ? new Date(String(body[field])) : null;
      else data[field] = body[field] === "" ? null : body[field];
    }
  }

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data,
    select: { id: true, profilePhotoUrl: true, phone: true, email: true, address: true, gender: true, dateOfBirth: true },
  });

  if (typeof data.email === "string" && employee.userId) {
    await prisma.user.update({ where: { id: employee.userId }, data: { email: data.email } }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, employee: updated });
}
