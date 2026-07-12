import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/password";

export async function GET() {
  try {
    // Test 1: find admin
    const users = await prisma.user.findMany({
      where: { OR: [{ username: "admin" }, { email: "admin@lana.local" }] },
      select: { id: true, username: true, email: true, isActive: true, name: true }
    });
    
    // Test 2: verify password
    const user = users[0];
    let pwOk = false;
    let hashPreview = "";
    if (user?.id) {
      const full = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
      hashPreview = (full?.passwordHash || "").substring(0, 20) + "...";
      pwOk = await verifyPassword("Admin@123456", full?.passwordHash || "");
    }
    
    return NextResponse.json({
      userCount: users.length,
      users: users.map(u => ({ id: u.id, username: u.username, email: u.email, isActive: u.isActive, name: u.name })),
      hashPreview,
      passwordOk: pwOk,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
