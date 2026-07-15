import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { answerLanaAi, getLanaAiMonitorData } from "@/lib/enterprise/lana-ai";
import { writeAuditLog } from "@/lib/audit";

function errorJson(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Lana AI request failed";
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const roles = (session.user.roles as string[]) ?? [];
    if (!roles.includes("SUPER_ADMIN") && !roles.includes("HR_MANAGER")) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const monitor = await getLanaAiMonitorData();
    return NextResponse.json({ success: true, monitor });
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null) as { message?: string } | null;
    const message = body?.message?.trim();
    if (!message) return NextResponse.json({ success: false, message: "Message is required" }, { status: 400 });

    const answer = await answerLanaAi({
      userId: session.user.id,
      roles: (session.user.roles as string[]) ?? [],
      permissions: (session.user.permissions as string[]) ?? [],
      message
    });

    await writeAuditLog({ actorUserId: session.user.id, action: "lana-ai:chat", entity: "lanaAi", metadata: { message } }).catch(() => null);
    // Sensitive fields (national ID, photo, contact info) are never written to
    // AuditLog -- only which employee(s) and which field NAMES were exposed.
    if (answer.sensitiveAccess?.employeeIds.length) {
      await writeAuditLog({
        actorUserId: session.user.id,
        action: "lana-ai:sensitive-data-access",
        entity: "employee",
        metadata: { employeeIds: answer.sensitiveAccess.employeeIds, fields: answer.sensitiveAccess.fields }
      }).catch(() => null);
    }
    return NextResponse.json({ success: true, ...answer });
  } catch (error) {
    return errorJson(error);
  }
}
