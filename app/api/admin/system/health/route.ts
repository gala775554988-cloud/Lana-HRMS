import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSystemHealthReport } from "@/lib/system/health";

function canViewSystem(session: any) {
  const roles = session?.user?.roles as string[] | undefined;
  const permissions = session?.user?.permissions as string[] | undefined;
  return Boolean(roles?.includes("SUPER_ADMIN") || roles?.includes("SYSTEM_ADMIN") || permissions?.includes("*:*") || permissions?.includes("read:settings") || permissions?.includes("manage:settings"));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!canViewSystem(session)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const report = await getSystemHealthReport();
  return NextResponse.json({ success: true, report });
}
