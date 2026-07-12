import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function GET() {
  const users = await prisma.user.findMany({
    where: { OR: [{ username: "admin" }, { email: { contains: "admin" } }] },
    select: { id: true, username: true, email: true, isActive: true },
  });
  
  if (users[0]) {
    const full = await prisma.user.findUnique({ where: { id: users[0].id }, select: { passwordHash: true } });
    const ok = await verifyPassword("Admin@123456", full?.passwordHash || "");
    return NextResponse.json({ count: users.length, users: users.map(u => ({id:u.id,username:u.username,email:u.email,isActive:u.isActive})), firstPasswordOk: ok });
  }
  return NextResponse.json({ error: "No users" });
}
