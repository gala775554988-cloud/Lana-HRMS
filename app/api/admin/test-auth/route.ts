import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { username: "admin" } });
    if (!user) return NextResponse.json({ error: "Admin not found" });
    const hash = user.passwordHash || "";
    const ok = await verifyPassword("Admin@123456", hash);
    return NextResponse.json({
      found: true, id: user.id, name: user.name,
      isActive: user.isActive, hasHash: !!user.passwordHash,
      hashStart: hash.substring(0, 15) + "...",
      passwordOk: ok,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
