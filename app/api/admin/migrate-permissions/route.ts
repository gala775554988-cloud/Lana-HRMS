import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const results: string[] = [];
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HrPermissionScope" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "module" TEXT NOT NULL, "scope" TEXT NOT NULL DEFAULT 'ALL', "branchId" TEXT, "departmentId" TEXT, "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())`);
    results.push("HrPermissionScope ✅");
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HrPermissionScope_userId_module_key" ON "HrPermissionScope"("userId","module")`);
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HrApprovalChain" ("id" TEXT NOT NULL PRIMARY KEY, "module" TEXT NOT NULL, "level" INTEGER NOT NULL DEFAULT 1, "approverRole" TEXT NOT NULL DEFAULT 'DIRECT_MANAGER', "isActive" BOOLEAN DEFAULT true, "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW())`);
    results.push("HrApprovalChain ✅");
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HrApprovalChain_module_level_key" ON "HrApprovalChain"("module","level")`);
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HrPermissionAudit" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "action" TEXT NOT NULL, "module" TEXT, "oldValue" TEXT, "newValue" TEXT, "byUserId" TEXT, "createdAt" TIMESTAMP DEFAULT NOW())`);
    results.push("HrPermissionAudit ✅");
    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, results }, { status: 500 });
  }
}
