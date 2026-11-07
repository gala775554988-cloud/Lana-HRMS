import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const preferences = z.object({
  theme: z.enum(["corporate", "purple", "blue", "emerald", "night", "minimal"]).optional(),
  language: z.enum(["ar", "en"]).optional(),
  timezone: z.enum(["Asia/Riyadh", "UTC", "Asia/Dubai", "Asia/Kuwait"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = preferences.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!employee) return NextResponse.json({ error: "No employee" }, { status: 404 });

  await prisma.employeePreference.upsert({
    where: { employeeId: employee.id },
    update: parsed.data,
    create: { ...parsed.data, employeeId: employee.id },
  });

  return NextResponse.json({ success: true });
}
