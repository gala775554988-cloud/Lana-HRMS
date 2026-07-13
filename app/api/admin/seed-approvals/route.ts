import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, string[]> = {
  leave:    ["DIRECT_MANAGER", "DEPARTMENT_MANAGER", "HR_MANAGER"],
  overtime: ["DIRECT_MANAGER", "DEPARTMENT_MANAGER", "HR_MANAGER"],
  loan:     ["DIRECT_MANAGER", "DEPARTMENT_MANAGER", "HR_MANAGER"],
  expense:  ["DIRECT_MANAGER", "DEPARTMENT_MANAGER", "HR_MANAGER"],
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const results: string[] = [];
  for (const [module, roles] of Object.entries(DEFAULTS)) {
    await prisma.hrApprovalChain.deleteMany({ where: { module } });
    for (let i = 0; i < roles.length; i++) {
      await prisma.hrApprovalChain.create({
        data: { module, level: i + 1, approverRole: roles[i], isActive: true },
      });
    }
    results.push(`${module}: ${roles.join(" → ")} ✅`);
  }
  return NextResponse.json({ success: true, results });
}
