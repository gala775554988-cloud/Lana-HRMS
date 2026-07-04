import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { employeeId, action } = body;

  // Verify employee belongs to user
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, userId: session.user.id },
  });

  if (!employee) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (action === "checkin") {
    await prisma.attendanceRecord.upsert({
      where: { employeeId_workDate: { employeeId, workDate: today } },
      update: { checkIn: new Date(), status: "PRESENT" },
      create: {
        employeeId,
        workDate: today,
        checkIn: new Date(),
        status: "PRESENT",
      },
    });
  } else if (action === "checkout") {
    await prisma.attendanceRecord.updateMany({
      where: { employeeId, workDate: today },
      data: { checkOut: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
