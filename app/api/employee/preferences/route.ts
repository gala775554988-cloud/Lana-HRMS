import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!employee) return NextResponse.json({ error: "No employee" }, { status: 404 });

  const body = await req.json();

  await prisma.employeePreference.upsert({
    where: { employeeId: employee.id },
    update: body,
    create: {
      employeeId: employee.id,
      ...body
    }
  });

  return NextResponse.json({ success: true });
}
