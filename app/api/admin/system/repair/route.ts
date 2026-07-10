import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { repairSystemData } from "@/lib/system/health";

function canRepairSystem(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || permissions?.includes("*:*") || permissions?.includes("manage:settings"));
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canRepairSystem(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const result = await repairSystemData(session.user.id);
  return NextResponse.json({ success: true, ...result });
}
