import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FIELD_LENGTH = 500;

function truncate(value: unknown, max = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Client-side crash telemetry: app/error.tsx fires this on mount so every
 * production crash lands in AuditLog (browsable at /audit-logs) instead of
 * only existing as a Vercel Runtime Log entry nobody has direct access to
 * from this environment. Deliberately unauthenticated -- the boundary can
 * fire before a session exists (e.g. on /login) -- but every field is
 * length-capped and type-checked before it ever reaches the database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await auth().catch(() => null);

    await prisma.auditLog.create({
      data: {
        actorUserId: session?.user?.id ?? null,
        action: "CLIENT_ERROR_REPORT",
        entity: "client_error",
        entityId: truncate(body?.digest, 100),
        metadata: {
          message: truncate(body?.message, 1000),
          name: truncate(body?.name, 200),
          path: truncate(body?.path, 500),
          userAgent: truncate(request.headers.get("user-agent"), 300),
          timestamp: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch {
    // Telemetry must never surface an error of its own to the user.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
