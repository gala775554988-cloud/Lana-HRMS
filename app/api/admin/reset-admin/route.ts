import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST() {
  const pw = "Admin@123456";
  const hash = await hashPassword(pw);
  const user = await prisma.user.upsert({
    where: { email: "admin@lana.local" },
    update: { passwordHash: hash, isActive: true, emailVerified: new Date(), mustChangePassword: false, passwordChanged: true },
    create: { name: "System Admin", email: "admin@lana.local", passwordHash: hash, isActive: true, emailVerified: new Date(), mustChangePassword: false, passwordChanged: true },
  });
  const role = await prisma.role.upsert({ where: { name: "SUPER_ADMIN" }, update: {}, create: { name: "SUPER_ADMIN", description: "Super Admin", isSystem: true } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  return NextResponse.json({ success: true, id: user.id, email: user.email });
}
