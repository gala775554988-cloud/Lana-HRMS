import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { ZodError } from "zod";
import { WORKFLOW_PATH_TYPES, getWorkflowPath, saveWorkflowPath, type WorkflowPathTypeValue } from "@/lib/enterprise/workflow-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(roles: string[] | undefined) {
  const roleSet = new Set(roles ?? []);
  return roleSet.has("SUPER_ADMIN") || roleSet.has("HR_MANAGER");
}

function isValidType(value: string | null): value is WorkflowPathTypeValue {
  return Boolean(value) && (WORKFLOW_PATH_TYPES as readonly string[]).includes(value as string);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isAuthorized(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const workflowType = request.nextUrl.searchParams.get("workflowType");
  if (!isValidType(workflowType)) {
    return NextResponse.json({ success: false, message: `workflowType must be one of: ${WORKFLOW_PATH_TYPES.join(", ")}` }, { status: 400 });
  }

  const path = await getWorkflowPath(workflowType);
  return NextResponse.json({ success: true, path });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!isAuthorized(session.user.roles as string[] | undefined)) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });

  try {
    const saved = await saveWorkflowPath(body, session.user.id);
    return NextResponse.json({ success: true, path: saved });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to save workflow path";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
