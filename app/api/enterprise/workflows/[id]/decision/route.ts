import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { decideWorkflowStep } from "@/lib/enterprise/workflow";

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as { decision?: "APPROVE" | "REJECT" | "RETURN"; comments?: string };
  if (!body.decision || !["APPROVE", "REJECT", "RETURN"].includes(body.decision)) {
    return NextResponse.json({ success: false, message: "Invalid decision" }, { status: 400 });
  }

  const workflow = await decideWorkflowStep({
    workflowInstanceId: id,
    actorUserId: session.user.id,
    decision: body.decision,
    comments: body.comments,
    ip: getClientIp(request)
  });

  return NextResponse.json({ success: true, workflow });
}
