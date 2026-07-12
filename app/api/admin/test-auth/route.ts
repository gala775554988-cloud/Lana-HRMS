import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/password";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { OR: [{ username: "admin" }, { email: "admin@lana.local" }] } });
    if (!user) return NextResponse.json({ error: "No admin" });

    const full = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, mustChangePassword: true, passwordChanged: true } });
    const pwOk = await verifyPassword("Admin@123456", full?.passwordHash || "");
    
    // Check roles
    const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: { select: { name: true } } } });
    
    return NextResponse.json({
      id: user.id, name: user.name, email: user.email, isActive: user.isActive,
      mustChangePassword: full?.mustChangePassword, passwordChanged: full?.passwordChanged,
      hashStart: (full?.passwordHash || "").substring(0, 15) + "...",
      passwordOk: pwOk,
      roles: roles.map(r => r.role.name),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
